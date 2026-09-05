import { useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '../components/ui';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="card p-12 text-center max-w-lg mx-auto mt-10 animate-rise">
      <span className="icon-tile w-14 h-14 tile-blue mx-auto">
        <Compass size={26} />
      </span>
      <h1 className="display-sm mt-5">That page does not exist</h1>
      <p className="text-sm text-[var(--slate)] mt-2 leading-relaxed">
        The link may be out of date, or the record it pointed at has been removed.
      </p>
      <Button variant="primary" className="mt-6" onClick={() => navigate('/')}>
        Back to the dashboard
      </Button>
    </div>
  );
}
