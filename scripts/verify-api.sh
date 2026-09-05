#!/usr/bin/env bash
# PeoplePay360 - end-to-end API verification.
#
# Drives the running server against the real database, the same way a judge
# would with curl. Reseeds first so it is repeatable.
#
#   Terminal 1:  cd server && npm run dev
#   Terminal 2:  bash scripts/verify-api.sh

API=http://localhost:4000/api/v1
PASS=0
FAIL=0

login() {
  curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"demo1234\"}" |
    node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).data.token)}catch(e){console.log('')}})"
}

# status TOKEN METHOD PATH [BODY]
status() {
  local tok=$1 method=$2 path=$3 body=$4
  if [ -n "$body" ]; then
    curl -s -o /dev/null -w '%{http_code}' -X "$method" "$API$path" \
      -H "Authorization: Bearer $tok" -H 'Content-Type: application/json' -d "$body"
  else
    curl -s -o /dev/null -w '%{http_code}' -X "$method" "$API$path" -H "Authorization: Bearer $tok"
  fi
}

body() {
  local tok=$1 method=$2 path=$3 payload=$4
  if [ -n "$payload" ]; then
    curl -s -X "$method" "$API$path" -H "Authorization: Bearer $tok" \
      -H 'Content-Type: application/json' -d "$payload"
  else
    curl -s -X "$method" "$API$path" -H "Authorization: Bearer $tok"
  fi
}

check() { # check "label" expected actual
  if [ "$2" = "$3" ]; then
    echo "  PASS  $1"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  $1  (expected $2, got $3)"
    FAIL=$((FAIL + 1))
  fi
}

jqn() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{let o;try{o=JSON.parse(d)}catch(e){return console.log('PARSE_ERROR')};const ex=process.argv[1];try{console.log(eval(ex[0]==='.'?'o'+ex:ex))}catch(e){console.log('undefined')}})" "$1"; }

SERVER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../server" && pwd)"

echo "=============================================="
echo " 0. RESET - reseed so the suite is re-runnable"
echo "=============================================="
# Each run creates payruns. Without a reset, a second run legitimately trips
# DUPLICATE_PAYSLIP on the same employee+period - the guard working, but it
# makes the suite non-repeatable. Start from the known demo state every time.
( cd "$SERVER_DIR" && npx tsx src/seed.ts ) >/dev/null 2>&1   && echo "  PASS  database reseeded" && PASS=$((PASS+1))   || { echo "  FAIL  reseed failed"; FAIL=$((FAIL+1)); }

echo
echo "=============================================="
echo " 1. AUTH - one login per role"
echo "=============================================="
ADMIN=$(login admin@peoplepay.com)
HRMGR=$(login hr@peoplepay.com)
PUSER=$(login payroll@peoplepay.com)
PMGR=$(login payrollmgr@peoplepay.com)
EMP=$(login aarav@peoplepay.com)

for pair in "ADMIN:$ADMIN" "HR_MANAGER:$HRMGR" "PAYROLL_USER:$PUSER" "PAYROLL_MGR:$PMGR" "EMPLOYEE:$EMP"; do
  name=${pair%%:*}; tok=${pair#*:}
  if [ -n "$tok" ]; then echo "  PASS  $name got a token"; PASS=$((PASS+1));
  else echo "  FAIL  $name got NO token"; FAIL=$((FAIL+1)); fi
done

check "GET /auth/me returns the caller" "HR_PAYROLL_MANAGER" "$(body "$PMGR" GET /auth/me | jqn '.data.role')"
check "no token -> 401" "401" "$(curl -s -o /dev/null -w '%{http_code}' "$API/employees")"
check "garbage token -> 401" "401" "$(status "not.a.token" GET /employees)"

echo
echo "=============================================="
echo " 2. THE WALL - HR_MANAGER locked out of payroll"
echo "=============================================="
check "HR_MANAGER GET /salary-structures -> 403" "403" "$(status "$HRMGR" GET /salary-structures)"
check "HR_MANAGER GET /salary-rules      -> 403" "403" "$(status "$HRMGR" GET /salary-rules)"
check "HR_MANAGER GET /payruns           -> 403" "403" "$(status "$HRMGR" GET /payruns)"
check "HR_MANAGER GET /payslips          -> 403" "403" "$(status "$HRMGR" GET /payslips)"
check "HR_MANAGER GET /dashboard         -> 403" "403" "$(status "$HRMGR" GET /dashboard)"
check "HR_MANAGER POST /payruns/eligible -> 403" "403" "$(status "$HRMGR" POST /payruns/eligible-employees '{"salaryStructureId":"st1","periodStart":"2026-09-01","periodEnd":"2026-09-30"}')"
check "HR_MANAGER CAN see employees      -> 200" "200" "$(status "$HRMGR" GET /employees)"
check "HR_MANAGER CAN see attendance     -> 200" "200" "$(status "$HRMGR" GET /attendance)"

echo
echo "=============================================="
echo " 3. HR_PAYROLL_USER - read salary, cannot write"
echo "=============================================="
check "GET  /salary-structures -> 200" "200" "$(status "$PUSER" GET /salary-structures)"
check "GET  /salary-rules      -> 200" "200" "$(status "$PUSER" GET /salary-rules)"
check "POST /salary-structures -> 403" "403" "$(status "$PUSER" POST /salary-structures '{"name":"Nope","rules":[]}')"
check "POST /salary-rules      -> 403" "403" "$(status "$PUSER" POST /salary-rules '{"structureId":"st1","name":"X","code":"X","category":"ALLOWANCE","sequence":999,"computeType":"FIXED","amount":1}')"
check "PATCH /salary-rules/sr1 -> 403" "403" "$(status "$PUSER" PATCH /salary-rules/sr1 '{"amount":1}')"
check "GET  /payruns           -> 200" "200" "$(status "$PUSER" GET /payruns)"

echo
echo "=============================================="
echo " 4. ADMIN /users - nobody changes their own role"
echo "=============================================="
check "ADMIN GET /users            -> 200" "200" "$(status "$ADMIN" GET /users)"
check "PAYROLL_MGR GET /users      -> 403" "403" "$(status "$PMGR" GET /users)"
check "HR_MANAGER GET /users       -> 403" "403" "$(status "$HRMGR" GET /users)"
check "ADMIN changing OWN role     -> 403" "403" "$(status "$ADMIN" PATCH /users/u0/role '{"role":"EMPLOYEE"}')"
check "ADMIN changing other's role -> 200" "200" "$(status "$ADMIN" PATCH /users/u3/role '{"role":"HR_PAYROLL_USER"}')"

echo
echo "=============================================="
echo " 5. EMPLOYEE self-scoping"
echo "=============================================="
EMPLIST=$(body "$EMP" GET /employees)
check "sees exactly 1 employee (self)" "1" "$(echo "$EMPLIST" | jqn '.data.length')"
check "and it is Aarav"        "Aarav Mehta" "$(echo "$EMPLIST" | jqn '.data[0].name')"
check "GET own record   -> 200" "200" "$(status "$EMP" GET /employees/e1)"
check "GET other's rec  -> 403" "403" "$(status "$EMP" GET /employees/e2)"
check "GET own balance  -> 200" "200" "$(status "$EMP" GET /timeoff/balance/e1)"
check "GET other bal    -> 403" "403" "$(status "$EMP" GET /timeoff/balance/e2)"
check "payslips scoped to self" "1" "$(body "$EMP" GET /payslips | jqn 'new Set(o.data.map(p=>p.employeeId)).size')"
check "EMPLOYEE POST /employees -> 403" "403" "$(status "$EMP" POST /employees '{"employeeCode":"X","name":"X","email":"x@x.com","departmentId":"d1"}')"

echo
echo "=============================================="
echo " 6. Employees + smart-button summary"
echo "=============================================="
check "list employees -> 200"    "200" "$(status "$PMGR" GET /employees)"
check "13 employees seeded"      "13"  "$(body "$PMGR" GET /employees?limit=100 | jqn '.meta.total')"
check "search finds Neha"        "1"   "$(body "$PMGR" GET '/employees?search=Neha' | jqn '.data.length')"
SUMMARY=$(body "$PMGR" GET /employees/e12/summary)
check "summary has 2 contracts (trap #1)" "2" "$(echo "$SUMMARY" | jqn '.data.contracts')"
check "departments endpoint -> 4" "4" "$(body "$PMGR" GET /employees/departments | jqn '.data.length')"

echo
echo "=============================================="
echo " 7. Contract resolution - the raise on the 16th"
echo "=============================================="
NEHA=$(body "$PMGR" GET '/contracts?employeeId=e12')
check "Neha has 2 contracts" "2" "$(echo "$NEHA" | jqn '.data.length')"
check "overlapping contract rejected -> 409" "409" "$(status "$PMGR" POST /contracts '{"employeeId":"e12","startDate":"2026-09-01","endDate":null,"wage":70000,"departmentId":"d2","status":"RUNNING"}')"

echo
echo "=============================================="
echo " 8. Attendance widget - check in / out"
echo "=============================================="
check "GET /attendance/active -> 200" "200" "$(status "$EMP" GET /attendance/active)"
BEFORE=$(body "$EMP" GET /attendance/active | jqn '.data.session')
CI=$(status "$EMP" POST /attendance/check-in)
check "first check-in  -> 201" "201" "$CI"
check "double check-in -> 409" "409" "$(status "$EMP" POST /attendance/check-in)"
check "active session now present" "true" "$(body "$EMP" GET /attendance/active | jqn '.data.session !== null')"
check "check-out -> 200" "200" "$(status "$EMP" POST /attendance/check-out)"
check "double check-out -> 409" "409" "$(status "$EMP" POST /attendance/check-out)"
check "session cleared" "true" "$(body "$EMP" GET /attendance/active | jqn '.data.session === null')"

echo
echo "=============================================="
echo " 9. Time off - approving twice must not double-deduct"
echo "=============================================="
BAL_BEFORE=$(body "$PMGR" GET /timeoff/allocations?employeeId=e1 | jqn '.data.find(a=>a.timeOffTypeId==="tt1").usedDays')
REQ=$(body "$PMGR" POST /timeoff/requests '{"employeeId":"e1","timeOffTypeId":"tt1","dateFrom":"2026-10-05","dateTo":"2026-10-06","reason":"e2e test"}')
REQID=$(echo "$REQ" | jqn '.data.id')
check "request created" "PENDING" "$(echo "$REQ" | jqn '.data.status')"
check "approve #1 -> 200" "200" "$(status "$PMGR" POST "/timeoff/requests/$REQID/approve")"
AFTER1=$(body "$PMGR" GET /timeoff/allocations?employeeId=e1 | jqn '.data.find(a=>a.timeOffTypeId==="tt1").usedDays')
check "approve #2 -> 200 (no-op)" "200" "$(status "$PMGR" POST "/timeoff/requests/$REQID/approve")"
AFTER2=$(body "$PMGR" GET /timeoff/allocations?employeeId=e1 | jqn '.data.find(a=>a.timeOffTypeId==="tt1").usedDays')
check "balance moved by exactly 2 days" "2" "$(node -e "console.log(Number($AFTER1)-Number($BAL_BEFORE))")"
check "second approve deducted NOTHING" "$AFTER1" "$AFTER2"
check "EMPLOYEE cannot approve -> 403" "403" "$(status "$EMP" POST "/timeoff/requests/$REQID/approve")"

# TRAP #5: 4 days against a 2-day remaining balance
check "over-balance request blocked -> 409" "409" "$(status "$PMGR" POST /timeoff/requests/tor3/approve)"

echo
echo "=============================================="
echo "10. PAYRUN WIZARD - step 2 creates nothing"
echo "=============================================="
BEFORE_RUNS=$(body "$PMGR" GET /payruns | jqn '.meta.total')
ELIG=$(body "$PMGR" POST /payruns/eligible-employees '{"salaryStructureId":"st1","periodStart":"2026-08-01","periodEnd":"2026-08-31"}')
check "eligible-employees -> 200" "200" "$(status "$PMGR" POST /payruns/eligible-employees '{"salaryStructureId":"st1","periodStart":"2026-09-01","periodEnd":"2026-09-30"}')"
AFTER_RUNS=$(body "$PMGR" GET /payruns | jqn '.meta.total')
check "preview created NO payrun" "$BEFORE_RUNS" "$AFTER_RUNS"
check "Dev Kumar flagged: no bank" "false" "$(echo "$ELIG" | jqn '.data.employees.find(e=>e.employeeId==="e9").hasBankAccount')"
check "Neha flagged: 2 contracts (Aug)" "2" "$(echo "$ELIG" | jqn '.data.employees.find(e=>e.employeeId==="e12").contractCount')"
check "Sept has only the later contract" "1" "$(body "$PMGR" POST /payruns/eligible-employees '{"salaryStructureId":"st1","periodStart":"2026-09-01","periodEnd":"2026-09-30"}' | jqn '.data.employees.find(e=>e.employeeId==="e12").contractCount')"

echo
echo "=============================================="
echo "11. Payrun compute - idempotent, then gated"
echo "=============================================="
RUN=$(body "$PMGR" POST /payruns '{"name":"E2E September 2026","salaryStructureId":"st1","periodStart":"2026-09-01","periodEnd":"2026-09-30","employeeIds":["e1","e9","e12"]}')
RUNID=$(echo "$RUN" | jqn '.data.id')
check "payrun created DRAFT" "DRAFT" "$(echo "$RUN" | jqn '.data.status')"
check "3 payslips created" "3" "$(echo "$RUN" | jqn '.data.payslips.length')"

C1=$(body "$PMGR" POST "/payruns/$RUNID/compute")
LINES1=$(body "$PMGR" GET "/payruns/$RUNID" | jqn '.data.payslips.reduce((n,p)=>n+p.lines.length,0)')
NET1=$(body "$PMGR" GET "/payruns/$RUNID" | jqn '.data.payslips.map(p=>p.net).join(",")')
check "compute -> COMPUTED" "COMPUTED" "$(echo "$C1" | jqn '.data.status')"

body "$PMGR" POST "/payruns/$RUNID/compute" > /dev/null
LINES2=$(body "$PMGR" GET "/payruns/$RUNID" | jqn '.data.payslips.reduce((n,p)=>n+p.lines.length,0)')
NET2=$(body "$PMGR" GET "/payruns/$RUNID" | jqn '.data.payslips.map(p=>p.net).join(",")')
check "compute twice: SAME line count" "$LINES1" "$LINES2"
check "compute twice: SAME net values" "$NET1" "$NET2"

# Dev Kumar (e9) has no bank account -> HIGH MISSING_BANK -> validate blocked
check "validate BLOCKED by HIGH warning -> 409" "409" "$(status "$PMGR" POST "/payruns/$RUNID/validate")"
check "mark-paid from COMPUTED -> 409" "409" "$(status "$PMGR" POST "/payruns/$RUNID/mark-paid")"

echo
echo "=============================================="
echo "12. Mid-period contract change - pro-ration"
echo "=============================================="
AUG=$(body "$PMGR" POST /payruns '{"name":"E2E August Neha","salaryStructureId":"st1","periodStart":"2026-08-01","periodEnd":"2026-08-31","employeeIds":["e12"]}')
AUGID=$(echo "$AUG" | jqn '.data.id')
body "$PMGR" POST "/payruns/$AUGID/compute" > /dev/null
AUGRUN=$(body "$PMGR" GET "/payruns/$AUGID")
check "warns CONTRACT_CHANGED_MID_PERIOD" "true" "$(echo "$AUGRUN" | jqn '.data.payslips[0].warnings.some(w=>w.code==="CONTRACT_CHANGED_MID_PERIOD")')"
BASIC=$(echo "$AUGRUN" | jqn '.data.payslips[0].lines.find(l=>l.ruleCode==="BASIC").amount')
# 27500*(15/31) + 34000*(16/31) = 30854.84
check "BASIC pro-rated across both contracts" "30854.84" "$BASIC"
check "gross - deductions = net" "true" "$(echo "$AUGRUN" | jqn 'Math.abs(o.data.payslips[0].gross-o.data.payslips[0].totalDeductions-o.data.payslips[0].net)<0.01')"

echo
echo "=============================================="
echo "13. Clean payrun -> validate -> paid -> locked"
echo "=============================================="
CLEAN=$(body "$PMGR" POST /payruns '{"name":"E2E Clean Sept","salaryStructureId":"st1","periodStart":"2026-09-01","periodEnd":"2026-09-30","employeeIds":["e2","e3"]}')
CLEANID=$(echo "$CLEAN" | jqn '.data.id')
body "$PMGR" POST "/payruns/$CLEANID/compute" > /dev/null
check "validate -> 200" "200" "$(status "$PMGR" POST "/payruns/$CLEANID/validate")"
check "status VALIDATED" "VALIDATED" "$(body "$PMGR" GET "/payruns/$CLEANID" | jqn '.data.status')"
check "mark-paid -> 200" "200" "$(status "$PMGR" POST "/payruns/$CLEANID/mark-paid")"
check "status PAID" "PAID" "$(body "$PMGR" GET "/payruns/$CLEANID" | jqn '.data.status')"
check "PAID is read-only: compute -> 409" "409" "$(status "$PMGR" POST "/payruns/$CLEANID/compute")"
check "PAID is read-only: validate -> 409" "409" "$(status "$PMGR" POST "/payruns/$CLEANID/validate")"
check "send-payslips on PAID -> 200" "200" "$(status "$PMGR" POST "/payruns/$CLEANID/send-payslips")"

echo
echo "=============================================="
echo "14. Payslip detail + PDF"
echo "=============================================="
PSLIP=$(body "$PMGR" GET "/payslips?payrunId=$CLEANID")
PSID=$(echo "$PSLIP" | jqn '.data[0].id')
check "payslip detail -> 200" "200" "$(status "$PMGR" GET "/payslips/$PSID")"
check "payslip cites its contract" "true" "$(body "$PMGR" GET "/payslips/$PSID" | jqn '.data.contract !== null')"
PDF_CT=$(curl -s -o /dev/null -w '%{content_type}' "$API/payslips/$PSID/pdf" -H "Authorization: Bearer $PMGR")
PDF_SZ=$(curl -s "$API/payslips/$PSID/pdf" -H "Authorization: Bearer $PMGR" | wc -c)
check "PDF content-type" "application/pdf" "$PDF_CT"
check "PDF is non-trivial (>2KB)" "true" "$(node -e "console.log($PDF_SZ>2000)")"
check "EMPLOYEE cannot read other's payslip -> 403" "403" "$(status "$EMP" GET "/payslips/$PSID")"
check "HR_MANAGER cannot read any payslip -> 403" "403" "$(status "$HRMGR" GET "/payslips/$PSID")"

echo
echo "=============================================="
echo "15. Dashboard - live numbers"
echo "=============================================="
DASH=$(body "$PMGR" GET '/dashboard?period=2026-08')
check "dashboard -> 200" "200" "$(status "$PMGR" GET '/dashboard?period=2026-08')"
check "has 6 KPIs" "6" "$(echo "$DASH" | jqn 'Object.keys(o.data.kpis).length')"
check "totalNetPaid > 0" "true" "$(echo "$DASH" | jqn 'o.data.kpis.totalNetPaid > 0')"
check "attendanceHealth is 0-1, not 100%" "true" "$(echo "$DASH" | jqn 'o.data.kpis.attendanceHealth>0 && o.data.kpis.attendanceHealth<1')"
check "trend has 6 months" "6" "$(echo "$DASH" | jqn 'o.data.monthlyNetTrend.length')"
check "salaryByDepartment populated" "true" "$(echo "$DASH" | jqn 'o.data.salaryByDepartment.length > 0')"
check "alerts populated" "true" "$(echo "$DASH" | jqn 'o.data.alerts.length > 0')"
FILTERED=$(body "$PMGR" GET '/dashboard?period=2026-08&departmentId=d1')
check "department filter CHANGES the numbers" "true" "$(node -e "
const a=$(echo "$DASH" | jqn 'o.data.kpis.totalNetPaid');
const b=$(echo "$FILTERED" | jqn 'o.data.kpis.totalNetPaid');
console.log(a!==b)")"

echo
echo "=============================================="
echo "16. Salary rule validation - circular refs"
echo "=============================================="
check "forward reference rejected -> 422" "422" "$(status "$PMGR" POST /salary-structures '{"name":"Bad","rules":[{"name":"Gross","code":"GROSS","category":"GROSS","sequence":10,"computeType":"FORMULA","formula":"BASIC + 1"},{"name":"Basic","code":"BASIC","category":"BASIC","sequence":20,"computeType":"FIXED","amount":100}]}')"
check "self reference rejected -> 422" "422" "$(status "$PMGR" POST /salary-structures '{"name":"Bad2","rules":[{"name":"Net","code":"NET","category":"NET","sequence":10,"computeType":"FORMULA","formula":"NET - 1"}]}')"
check "duplicate code rejected -> 422" "422" "$(status "$PMGR" POST /salary-structures '{"name":"Bad3","rules":[{"name":"A","code":"X","category":"BASIC","sequence":10,"computeType":"FIXED","amount":1},{"name":"B","code":"X","category":"BASIC","sequence":20,"computeType":"FIXED","amount":2}]}')"
check "code injection in formula -> 422" "422" "$(status "$PMGR" POST /salary-structures '{"name":"Evil","rules":[{"name":"E","code":"E","category":"BASIC","sequence":10,"computeType":"FORMULA","formula":"process.exit(1)"}]}')"
check "valid structure accepted -> 201" "201" "$(status "$PMGR" POST /salary-structures '{"name":"E2E Valid Structure","rules":[{"name":"Basic","code":"BASIC","category":"BASIC","sequence":10,"computeType":"PERCENTAGE","percentage":60,"baseRuleCode":null},{"name":"Net","code":"NET","category":"NET","sequence":100,"computeType":"FORMULA","formula":"BASIC"}]}')"

echo
echo "=============================================="
echo "17. Grievances"
echo "=============================================="
GR=$(body "$EMP" POST /grievances '{"subject":"E2E test grievance","description":"Raised by the e2e suite."}')
GRID=$(echo "$GR" | jqn '.data.id')
check "employee can raise one -> OPEN" "OPEN" "$(echo "$GR" | jqn '.data.status')"
check "raised against SELF" "e1" "$(echo "$GR" | jqn '.data.employeeId')"
check "employee cannot resolve -> 403" "403" "$(status "$EMP" PATCH "/grievances/$GRID" '{"status":"RESOLVED"}')"
check "payroll user CAN resolve -> 200" "200" "$(status "$PUSER" PATCH "/grievances/$GRID" '{"status":"RESOLVED","response":"Handled."}')"

echo
echo "=============================================="
echo "18. Envelope + validation contract"
echo "=============================================="
check "404 uses envelope" "NOT_FOUND" "$(body "$PMGR" GET /employees/does-not-exist | jqn '.error.code')"
check "422 on bad body" "VALIDATION_ERROR" "$(body "$PMGR" POST /employees '{"name":""}' | jqn '.error.code')"
check "list responses carry meta" "true" "$(body "$PMGR" GET /employees | jqn 'o.meta && typeof o.meta.total==="number"')"
check "success flag present" "true" "$(body "$PMGR" GET /employees | jqn 'o.success===true')"

echo
echo "=============================================="
printf " RESULT: %d passed, %d failed\n" "$PASS" "$FAIL"
echo "=============================================="
[ "$FAIL" -eq 0 ]
