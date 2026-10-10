/** Each faculty route settles in with a short rise. CSS-only, so it never delays content. */
export default function FacultyTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-enter">{children}</div>;
}
