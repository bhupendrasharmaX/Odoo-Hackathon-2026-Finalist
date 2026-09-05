import { validateRuleSet, type EngineRule } from '../../core/salary-engine';
import { conflict, notFound } from '../../http/errors';
import type { PageParams } from '../../http/pagination';
import { writeAudit } from '../../lib/audit';
import { prisma } from '../../lib/prisma';
import { toSalaryRule, toSalaryStructure } from '../../lib/serialize';

/**
 * Salary structures and rules.
 *
 * Every write re-validates the WHOLE rule set through `validateRuleSet`, not
 * just the rule being saved. A forward reference is a property of the set, not
 * of one rule: lowering GROSS's sequence below BASIC's breaks GROSS's formula
 * even though GROSS itself was not the row that changed.
 *
 * Validating on save is what makes a circular reference unconstructible, so
 * the engine never has to defend against one at compute time.
 */

const STRUCTURE_INCLUDE = {
  rules: { orderBy: { sequence: 'asc' as const } },
} as const;

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Maps stored rules into the engine's plain shape for validation. */
function toEngineRules(rows: any[]): EngineRule[] {
  return rows.map((row) => ({
    code: row.code,
    name: row.name,
    category: row.category,
    sequence: row.sequence,
    computeType: row.computeType,
    amount: row.amount === null || row.amount === undefined ? null : Number(row.amount),
    percentage:
      row.percentage === null || row.percentage === undefined ? null : Number(row.percentage),
    formula: row.formula ?? null,
    baseRuleCode: row.baseRuleCode ?? null,
  }));
}

// ---------------------------------------------------------------------
// Structures
// ---------------------------------------------------------------------

export async function listStructures(page: PageParams) {
  const [rows, total] = await Promise.all([
    prisma.salaryStructure.findMany({
      include: { ...STRUCTURE_INCLUDE, _count: { select: { rules: true, contracts: true } } },
      orderBy: { name: 'asc' },
      skip: page.skip,
      take: page.take,
    }),
    prisma.salaryStructure.count(),
  ]);

  return { data: rows.map(toSalaryStructure), total };
}

export async function getStructure(id: string) {
  const row = await prisma.salaryStructure.findUnique({
    where: { id },
    include: STRUCTURE_INCLUDE,
  });
  if (!row) throw notFound('Salary structure not found');
  return toSalaryStructure(row);
}

export interface RuleInput {
  name: string;
  code: string;
  category: string;
  sequence: number;
  computeType: string;
  amount?: number | null;
  percentage?: number | null;
  formula?: string | null;
  baseRuleCode?: string | null;
}

export async function createStructure(
  input: { name: string; rules?: RuleInput[] },
  actorUserId: string,
) {
  const rules = input.rules ?? [];

  if (rules.length > 0) {
    // Throws VALIDATION_ERROR before a row is written.
    validateRuleSet(toEngineRules(rules));
  }

  const created = await prisma.salaryStructure.create({
    data: {
      name: input.name.trim(),
      rules: {
        create: rules.map((rule) => ({
          name: rule.name.trim(),
          code: rule.code.trim().toUpperCase(),
          category: rule.category as never,
          sequence: rule.sequence,
          computeType: rule.computeType as never,
          amount: rule.amount ?? null,
          percentage: rule.percentage ?? null,
          formula: rule.formula ?? null,
          baseRuleCode: rule.baseRuleCode ? rule.baseRuleCode.trim().toUpperCase() : null,
        })),
      },
    },
    include: STRUCTURE_INCLUDE,
  });

  await writeAudit({
    userId: actorUserId,
    action: 'CREATE',
    entityType: 'SalaryStructure',
    entityId: created.id,
    changes: { name: created.name, ruleCount: rules.length },
  });

  return toSalaryStructure(created);
}

/**
 * Renames a structure and optionally REPLACES its whole rule set.
 *
 * Replace rather than patch, for the same reason schedules replace their
 * lines: the UI edits the sequence-ordered table as one unit, and a partial
 * apply could leave a structure in a state `validateRuleSet` would reject.
 */
export async function updateStructure(
  id: string,
  input: { name?: string; rules?: RuleInput[] },
  actorUserId: string,
) {
  const existing = await prisma.salaryStructure.findUnique({ where: { id } });
  if (!existing) throw notFound('Salary structure not found');

  if (input.rules) {
    validateRuleSet(toEngineRules(input.rules));
  }

  const updated = await prisma.$transaction(async (tx: any) => {
    if (input.name !== undefined) {
      await tx.salaryStructure.update({ where: { id }, data: { name: input.name.trim() } });
    }

    if (input.rules) {
      await tx.salaryRule.deleteMany({ where: { structureId: id } });
      if (input.rules.length > 0) {
        await tx.salaryRule.createMany({
          data: input.rules.map((rule) => ({
            structureId: id,
            name: rule.name.trim(),
            code: rule.code.trim().toUpperCase(),
            category: rule.category as never,
            sequence: rule.sequence,
            computeType: rule.computeType as never,
            amount: rule.amount ?? null,
            percentage: rule.percentage ?? null,
            formula: rule.formula ?? null,
            baseRuleCode: rule.baseRuleCode ? rule.baseRuleCode.trim().toUpperCase() : null,
          })),
        });
      }
    }

    return tx.salaryStructure.findUnique({ where: { id }, include: STRUCTURE_INCLUDE });
  });

  await writeAudit({
    userId: actorUserId,
    action: 'UPDATE',
    entityType: 'SalaryStructure',
    entityId: id,
    changes: { name: input.name, ruleCount: input.rules?.length },
  });

  return toSalaryStructure(updated);
}

// ---------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------

export async function listRules(filters: { structureId?: string }, page: PageParams) {
  const where: Record<string, unknown> = {};
  if (filters.structureId) where.structureId = filters.structureId;

  const [rows, total] = await Promise.all([
    prisma.salaryRule.findMany({
      where,
      orderBy: [{ structureId: 'asc' }, { sequence: 'asc' }],
      skip: page.skip,
      take: page.take,
    }),
    prisma.salaryRule.count({ where }),
  ]);

  return { data: rows.map(toSalaryRule), total };
}

/** Adds one rule, validating it against every other rule in its structure. */
export async function createRule(
  input: RuleInput & { structureId: string },
  actorUserId: string,
) {
  const structure = await prisma.salaryStructure.findUnique({
    where: { id: input.structureId },
    include: STRUCTURE_INCLUDE,
  });
  if (!structure) throw notFound('That salary structure does not exist');

  const code = input.code.trim().toUpperCase();

  if (structure.rules.some((rule: any) => rule.code === code)) {
    throw conflict(`Rule code "${code}" is already used in this structure`);
  }

  // Validate the set AS IT WILL BE, not the incoming rule alone.
  validateRuleSet(toEngineRules([...structure.rules, { ...input, code }]));

  const created = await prisma.salaryRule.create({
    data: {
      structureId: input.structureId,
      name: input.name.trim(),
      code,
      category: input.category as never,
      sequence: input.sequence,
      computeType: input.computeType as never,
      amount: input.amount ?? null,
      percentage: input.percentage ?? null,
      formula: input.formula ?? null,
      baseRuleCode: input.baseRuleCode ? input.baseRuleCode.trim().toUpperCase() : null,
    },
  });

  await writeAudit({
    userId: actorUserId,
    action: 'CREATE',
    entityType: 'SalaryRule',
    entityId: created.id,
    changes: { structureId: input.structureId, code },
  });

  return toSalaryRule(created);
}

export async function updateRule(
  id: string,
  input: Partial<RuleInput>,
  actorUserId: string,
) {
  const existing = await prisma.salaryRule.findUnique({ where: { id } });
  if (!existing) throw notFound('Salary rule not found');

  const siblings = await prisma.salaryRule.findMany({
    where: { structureId: existing.structureId },
  });

  const code = input.code ? input.code.trim().toUpperCase() : existing.code;

  if (code !== existing.code && siblings.some((rule: any) => rule.code === code)) {
    throw conflict(`Rule code "${code}" is already used in this structure`);
  }

  const merged = {
    ...existing,
    ...input,
    code,
    baseRuleCode:
      input.baseRuleCode === undefined
        ? existing.baseRuleCode
        : input.baseRuleCode
          ? input.baseRuleCode.trim().toUpperCase()
          : null,
  };

  // Again, validate the whole set as it will be after this edit.
  validateRuleSet(
    toEngineRules(siblings.map((rule: any) => (rule.id === id ? merged : rule))),
  );

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.code !== undefined) data.code = code;
  if (input.category !== undefined) data.category = input.category;
  if (input.sequence !== undefined) data.sequence = input.sequence;
  if (input.computeType !== undefined) data.computeType = input.computeType;
  if (input.amount !== undefined) data.amount = input.amount;
  if (input.percentage !== undefined) data.percentage = input.percentage;
  if (input.formula !== undefined) data.formula = input.formula;
  if (input.baseRuleCode !== undefined) data.baseRuleCode = merged.baseRuleCode;

  const updated = await prisma.salaryRule.update({ where: { id }, data });

  await writeAudit({
    userId: actorUserId,
    action: 'UPDATE',
    entityType: 'SalaryRule',
    entityId: id,
    changes: data,
  });

  return toSalaryRule(updated);
}
