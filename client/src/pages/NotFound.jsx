import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="container narrow section center">
      <p className="hero__eyebrow">404</p>
      <h1 className="page-title">This page rolled its own credits</h1>
      <p className="page-lead">The link you followed does not lead anywhere.</p>
      <Link to="/" className="btn btn--primary">
        Back to the films
      </Link>
    </div>
  );
}
