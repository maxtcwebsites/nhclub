import { Link } from 'react-router-dom';
import { Empty } from '../components/ui.jsx';

export default function NotFound() {
  return (
    <div className="card">
      <Empty icon="🧭" title="Page not found">
        <p>The page you’re looking for doesn’t exist.</p>
        <Link to="/">Go to the home page</Link>
      </Empty>
    </div>
  );
}
