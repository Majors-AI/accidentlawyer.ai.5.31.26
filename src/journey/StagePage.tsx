// Generic placeholder rendered by every stage route while the real surfaces
// are built out. Shows the stage name and a "coming soon" subtitle.

export default function StagePage({ title }: { title: string }) {
  return (
    <div className="page-h">
      <div className="page-h-left">
        <h1>{title}</h1>
        <div className="sub">Coming soon — scaffold</div>
      </div>
    </div>
  );
}
