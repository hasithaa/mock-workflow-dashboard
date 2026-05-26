export default function StatusBadge({ status }) {
  const cls = ['Running','Completed','Failed','Canceled','Terminated','TimedOut'].includes(status)
    ? `badge badge-${status}` : 'badge badge-default';
  return <span className={cls}>{status}</span>;
}
