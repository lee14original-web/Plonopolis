import React from "react";

export function AnimalImg({ id, icon, className }: { id: string; icon: string; className?: string }) {
  const [err, setErr] = React.useState(false);
  if (err) return <span className={className}>{icon}</span>;
  return (
    <img
      src={`/zwierzeta/${id}.png`}
      alt={id}
      onError={() => setErr(true)}
      className={className}
      style={{ objectFit: "contain" }}
      draggable={false}
    />
  );
}
