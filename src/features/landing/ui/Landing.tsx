import { Link } from "@tanstack/react-router";
import { useId } from "react";
import type { ReactNode } from "react";

import { ThemePicker, themeOptionLabels } from "~/features/theming";
import { m } from "~/i18n/paraglide/messages";
import { LanguagePicker } from "~/shared/ui";

import { NandPanel } from "./NandPanel";

import styles from "./Landing.module.css";

interface ProjectLink {
  readonly id: string;
  readonly name: string;
}

interface LandingProps {
  /** The button that starts a new project. */
  readonly primaryAction: ReactNode;
  /** Storage problems to show above everything else. */
  readonly notices: ReactNode;
  /** The saved projects, each opened by its card. */
  readonly projects: readonly ProjectLink[];
  /** Rows (`<li>`) for records that cannot be opened, listed after the cards. */
  readonly damaged: readonly ReactNode[];
}

interface Step {
  readonly title: () => string;
  readonly text: () => string;
}

const STEPS: readonly Step[] = [
  { title: () => m.landing_step_nand_title(), text: () => m.landing_step_nand() },
  { title: () => m.landing_step_gates_title(), text: () => m.landing_step_gates() },
  { title: () => m.landing_step_arithmetic_title(), text: () => m.landing_step_arithmetic() },
  { title: () => m.landing_step_memory_title(), text: () => m.landing_step_memory() },
  { title: () => m.landing_step_computer_title(), text: () => m.landing_step_computer() },
];

function GateMark(): ReactNode {
  return (
    <svg className={styles.mark} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M4 6 H14 A10 10 0 0 1 14 26 H4 Z" />
      <circle cx="27" cy="16" r="3" />
    </svg>
  );
}

function Header(): ReactNode {
  return (
    <header className={styles.header}>
      <span className={styles.brand}>
        <GateMark />
        {m.app_title()}
      </span>
      <div className={styles.preferences}>
        <ThemePicker label={m.theme_label()} optionLabels={themeOptionLabels()} isLabelHidden />
        <LanguagePicker isLabelHidden />
      </div>
    </header>
  );
}

function Title(): ReactNode {
  return (
    <h1 className={styles.title}>
      {m.landing_title_lead()} <span className={styles.accent}>{m.landing_title_accent()}</span>
    </h1>
  );
}

function Actions({ primaryAction }: { readonly primaryAction: ReactNode }): ReactNode {
  return (
    <div className={styles.actions}>
      {primaryAction}
      <a className={styles.secondary} href="#path">
        {m.landing_see_path()}
      </a>
    </div>
  );
}

function Status(): ReactNode {
  return (
    <p className={styles.status}>
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.state}>{m.landing_status_label()}</span>
      {m.landing_status()}
    </p>
  );
}

function Hero({ primaryAction }: { readonly primaryAction: ReactNode }): ReactNode {
  return (
    <section className={styles.hero}>
      <div className={styles.copy}>
        <p className={styles.tag}>{m.landing_tag()}</p>
        <Title />
        <p className={styles.intro}>{m.landing_intro()}</p>
        <Actions primaryAction={primaryAction} />
        <Status />
      </div>
      <NandPanel />
    </section>
  );
}

interface SectionHeadProps {
  readonly headingId: string;
  readonly tag: string;
  readonly heading: string;
  readonly summary?: string;
}

function SectionHead({ headingId, tag, heading, summary }: Readonly<SectionHeadProps>): ReactNode {
  return (
    <div className={styles.head}>
      <p className={styles.tag}>{tag}</p>
      <h2 id={headingId} className={styles.heading}>
        {heading}
      </h2>
      {summary === undefined ? undefined : <p className={styles.summary}>{summary}</p>}
    </div>
  );
}

function PathStep({ step }: { readonly step: Step }): ReactNode {
  return (
    <li className={styles.step}>
      <h3>{step.title()}</h3>
      <p>{step.text()}</p>
    </li>
  );
}

function Path(): ReactNode {
  const headingId = useId();
  return (
    <section id="path" className={styles.section} aria-labelledby={headingId}>
      <SectionHead
        headingId={headingId}
        tag={m.landing_path_tag()}
        heading={m.landing_path_heading()}
        summary={m.landing_path_intro()}
      />
      <ol className={styles.steps}>
        {STEPS.map((step) => (
          <PathStep key={step.title()} step={step} />
        ))}
      </ol>
    </section>
  );
}

function ProjectCard({ project }: { readonly project: ProjectLink }): ReactNode {
  return (
    <li>
      <Link className={styles.card} to="/projects/$projectId" params={{ projectId: project.id }}>
        <GateMark />
        {project.name}
      </Link>
    </li>
  );
}

interface ProjectListProps {
  readonly projects: readonly ProjectLink[];
  readonly damaged: readonly ReactNode[];
}

function ProjectList({ projects, damaged }: ProjectListProps): ReactNode {
  if (projects.length === 0 && damaged.length === 0) {
    return <p className={styles.summary}>{m.projects_empty()}</p>;
  }
  return (
    <>
      {projects.length === 0 ? undefined : (
        <ul className={styles.projects}>
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </ul>
      )}
      {damaged.length === 0 ? undefined : <ul className={styles.damaged}>{damaged}</ul>}
    </>
  );
}

function Projects({ projects, damaged }: ProjectListProps): ReactNode {
  const headingId = useId();
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <SectionHead
        headingId={headingId}
        tag={m.landing_workspace_tag()}
        heading={m.projects_heading()}
      />
      <ProjectList projects={projects} damaged={damaged} />
    </section>
  );
}

/** The index page: what the app is, the saved projects, and the way from NAND to a computer. */
export function Landing({
  primaryAction,
  notices,
  projects,
  damaged,
}: Readonly<LandingProps>): ReactNode {
  return (
    <div className={styles.root}>
      <Header />
      <main className={styles.main}>
        {notices}
        <Hero primaryAction={primaryAction} />
        <Projects projects={projects} damaged={damaged} />
        <Path />
      </main>
      <footer className={styles.footer}>
        <GateMark />
        <p>{m.landing_footer()}</p>
      </footer>
    </div>
  );
}
