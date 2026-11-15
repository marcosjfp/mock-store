import { Compass } from "lucide-react";
import { Link } from "react-router-dom";

import { EmptyState } from "../components/ui/primitives";

export default function NotFoundPage() {
  return (
    <div className="card">
      <EmptyState
        icon={<Compass />}
        title="Page not found"
        description="That page doesn’t exist, or your role doesn’t have access to it."
        action={
          <Link to="/" className="btn btn-primary">
            Back to overview
          </Link>
        }
      />
    </div>
  );
}
