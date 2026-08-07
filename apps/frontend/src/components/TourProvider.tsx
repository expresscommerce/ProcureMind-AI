"use client";

import { useEffect, useMemo, useState } from "react";
import { Joyride, EVENTS, STATUS } from "react-joyride";
import type { Step, EventData } from "react-joyride";
import { useAuth } from "./AuthProvider";
import { usePathname } from "next/navigation";

const LS_KEY = "procuremind-tour-seen";

const STEPS: Step[] = [
  {
    target: "[data-tour='nav-overview']",
    title: "Overview",
    content: "Start here to see a high-level summary of spend, discrepancies, and risks.",
    placement: "right",
  },
  {
    target: "[data-tour='nav-documents']",
    title: "Vendor Documents",
    content: "Upload vendor proposals here to begin your audit.",
    placement: "right",
  },
  {
    target: "[data-tour='nav-vendors']",
    title: "Vendor Directory",
    content: "Browse all vendors and their details in one place.",
    placement: "right",
  },
  {
    target: "[data-tour='nav-comparison']",
    title: "Comparison Matrix",
    content: "Compare vendor proposals side-by-side across all criteria.",
    placement: "right",
  },
  {
    target: "[data-tour='nav-cost']",
    title: "Cost Analysis",
    content: "Dive into cost breakdowns and identify pricing discrepancies.",
    placement: "right",
  },
  {
    target: "[data-tour='nav-risk']",
    title: "Risk Assessment",
    content: "Review financial and security risk flags for each vendor.",
    placement: "right",
  },
  {
    target: "[data-tour='nav-compliance']",
    title: "Compliance",
    content: "Check policy compliance across frameworks.",
    placement: "right",
  },
  {
    target: "[data-tour='nav-sla']",
    title: "SLA Tracker",
    content: "Track service level agreements and deadlines.",
    placement: "right",
  },
  {
    target: "[data-tour='nav-summary']",
    title: "Executive Summary",
    content: "Generate a high-level summary report for stakeholders.",
    placement: "right",
  },
  {
    target: "[data-tour='nav-outcomes']",
    title: "Log Outcomes",
    content: "Record final contract outcomes and feedback.",
    placement: "right",
  },
];

export function TourProvider() {
  const { session, isLoading } = useAuth();
  const [run, setRun] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const steps = useMemo<Step[]>(() => {
    if (!isMobile) return STEPS;
    return [
      {
        target: "[data-tour='nav-overview-mobile']",
        title: "Overview",
        content: "Tap the menu button to open navigation and explore the app.",
        placement: "bottom",
      },
      ...STEPS.slice(0),
    ];
  }, [isMobile]);

  useEffect(() => {
    if (isLoading || !session) return;

    const seen = localStorage.getItem(LS_KEY);
    const queryParams = new URLSearchParams(window.location.search);
    const forceStart = queryParams.get("startTour");
    if (seen !== "true" || forceStart === "true") {
      const timer = setTimeout(() => setRun(true), 800);
      return () => clearTimeout(timer);
    }
  }, [session, isLoading, pathname]);

  const handleFinish = () => {
    localStorage.setItem(LS_KEY, "true");
    setRun(false);
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      options={{
        primaryColor: "#1e3a5f",
        backgroundColor: "#ffffff",
        textColor: "#1a1a1a",
        overlayColor: "#00000080",
        skipScroll: false,
        showProgress: true,
        buttons: ["back", "close", "primary", "skip"],
      }}
      onEvent={(data: EventData) => {
        if (data.type === EVENTS.TOUR_END) {
          if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
            handleFinish();
          }
        }
        if (
          isMobile &&
          data.index === 0 &&
          (data.type === EVENTS.BEACON || data.type === EVENTS.STEP_BEFORE)
        ) {
          window.dispatchEvent(new CustomEvent("open-mobile-sidebar"));
        }
      }}
    />
  );
}
