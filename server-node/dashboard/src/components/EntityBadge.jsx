import React from 'react';
import { Link } from 'react-router-dom';

export default function EntityBadge({ type, label, to, mono = false }) {
  const body = (
    <>
      {type ? <span className="console-entity-type">{type}</span> : null}
      <span className={mono ? 'mono' : undefined}>{label}</span>
    </>
  );
  if (to) {
    return (
      <Link to={to} className="console-entity-badge">
        {body}
      </Link>
    );
  }
  return <span className="console-entity-badge">{body}</span>;
}
