import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRightIcon, CoinsIcon, KeyIcon, PlayIcon, TerminalIcon } from "@/components/icons";
import { getSession } from "@/lib/session";
import { getUser } from "@/lib/users";
import { ActivityTable } from "./activity-table";
import { KpiStrip } from "./overview";
import { PageHeader } from "./page-header";

export const metadata = { title: "Overview — Kredit" };

const nextSteps = [
  { icon: CoinsIcon, title: "Buy credits", text: "Pay by card or UPI; credits land in your balance at once", href: "/dashboard/credits", action: "Buy credits" },
  { icon: KeyIcon, title: "Create an API key", text: "Use your credits in Cursor, Postman or code", href: "/dashboard/keys", action: "Create key" },
  { icon: PlayIcon, title: "Try a model", text: "Spend a few credits in the playground", href: "/playground", action: "Open playground" },
  { icon: TerminalIcon, title: "Read the docs", text: "Every endpoint, with runnable examples", href: "/docs", action: "Open docs" },
];

export default async function Overview() {
  const session = await getSession();
  if (!session) redirect("/");
  const user = await getUser(session.userId);

  return (
    <>
      <PageHeader title="Overview" lede={user?.email ?? user?.name ?? "Signed in"}>
        <Link href="/dashboard/keys" className="btn-sm">
          Create key
        </Link>
        <Link href="/dashboard/credits" className="btn-sm btn-sm-primary">
          Buy credits
        </Link>
      </PageHeader>

      <KpiStrip />

      <div className="stagger mt-10 grid gap-x-10 gap-y-10 lg:grid-cols-12">
        <section className="min-w-0 lg:col-span-7">
          <h2 className="section-label">
            Recent activity
            <Link href="/dashboard/activity" className="group flex items-center gap-1 text-xs font-normal text-mist transition hover:text-fog">
              View all <ArrowRightIcon className="size-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </h2>
          <div className="mt-1">
            <ActivityTable limit={6} />
          </div>
        </section>

        <section className="min-w-0 lg:col-span-5">
          <h2 className="section-label">Next steps</h2>
          <ul>
            {nextSteps.map(({ icon: Icon, title, text, href, action }) => (
              // On a phone the button drops under the words instead of squeezing them.
              <li key={href} className="entity flex-wrap">
                <span className="entity-icon">
                  <Icon />
                </span>
                <div className="min-w-0 flex-1 basis-56">
                  <p className="font-medium">{title}</p>
                  <p className="text-xs text-mist">{text}</p>
                </div>
                <Link href={href} className="btn-sm ml-auto">
                  {action}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
