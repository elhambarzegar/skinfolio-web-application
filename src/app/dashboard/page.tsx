import { redirect } from "next/navigation";

/** The old dashboard is now Today (plus Shelf, Routine, Progress and Me). */
export default function DashboardRedirect() {
  redirect("/today");
}
