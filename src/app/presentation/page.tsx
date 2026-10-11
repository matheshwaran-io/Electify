import { redirect } from "next/navigation";

export const metadata = {
  title: "Electify — Technical Architecture & Executive Presentation Deck",
  description: "Interactive presentation deck explaining Electify's architecture, database design, roles, and concurrency models.",
};

export default function PresentationPage() {
  redirect("/presentation.html");
}
