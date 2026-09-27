"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const TOUR_COMPLETED_COOKIE = "owner_workflow_tour_completed";
const TOUR_STATE_KEY = "owner_workflow_tour_state";

const ROUTE_FLOW = [
  "/dashboard",
  "/inventory",
  "/new-product-category",
  "/detection",
  "/billing",
  "/credit",
  "/workspace",
  "/notes",
  "/cashiers",
  "/settings",
  "/profile",
];

const ROUTE_STEP_CONFIG = {
  "/dashboard": {
    title: "Dashboard Overview",
    text: "This is your business command center where you get a quick health check of sales, trends, and activity. You also have a helpful owner chatbot at the bottom-right to ask questions about sales, inventory, credits, and daily business insights.",
    attachTo: "#owner-tour-nav-dashboard",
  },
  "/inventory": {
    title: "Inventory Management",
    text: "Track stock, identify low inventory, and keep products updated from this page.",
    attachTo: "#owner-tour-nav-inventory",
  },
  "/new-product-category": {
    title: "Create Product Categories",
    text: "Use this page to upload images of a new product in the market that out model is not detecting.",
    attachTo: "#owner-tour-nav-new-category",
  },
  "/detection": {
    title: "Smart Billing Counter",
    text: "Use detection mode to scan items quickly and prepare customer billing.",
    attachTo: "#owner-tour-nav-detection",
  },
  "/billing": {
    title: "Manual Billing",
    text: "Create and finalize bills manually when needed, including payment method handling.",
  },
  "/credit": {
    title: "Credit Management",
    text: "Review pending credits and clear dues from this credit dashboard.",
    attachTo: "#owner-tour-nav-credit",
  },
  "/workspace": {
    title: "Workspace",
    text: "Manage your planning and daily work items from the workspace tools.",
    attachTo: "#owner-tour-nav-workspace",
  },
  "/notes": {
    title: "Notes",
    text: "Capture reminders and quick notes related to your store operations.",
    attachTo: "#owner-tour-nav-notes",
  },
  "/cashiers": {
    title: "Cashier Management",
    text: "Add and manage cashier accounts who can operate billing and sales activities.",
  },
  "/settings": {
    title: "Settings",
    text: "Configure notifications, export data, and key preferences for your shop.",
  },
  "/profile": {
    title: "Profile",
    text: "Update your profile and account details here. This completes your owner workflow tour.",
    attachTo: "#owner-tour-profile-link",
  },
};

function readTourState() {
  try {
    const raw = localStorage.getItem(TOUR_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.index !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeTourState(state) {
  localStorage.setItem(TOUR_STATE_KEY, JSON.stringify(state));
}

function clearTourState() {
  localStorage.removeItem(TOUR_STATE_KEY);
}

function readCookie(name) {
  if (typeof document === "undefined") return "";
  const prefix = `${name}=`;
  const parts = document.cookie ? document.cookie.split("; ") : [];
  for (const part of parts) {
    if (part.startsWith(prefix)) {
      return decodeURIComponent(part.slice(prefix.length));
    }
  }
  return "";
}

function writeCookie(name, value, maxAgeSeconds) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
}

function isTourCompleted() {
  return readCookie(TOUR_COMPLETED_COOKIE) === "true";
}

function setTourCompleted(value) {
  // Persist across localStorage.clear() during logout/signout.
  writeCookie(TOUR_COMPLETED_COOKIE, value ? "true" : "false", 60 * 60 * 24 * 365);
}

function buildStepButtons({
  onSkip,
  onPreviousRoute,
  onNextRoute,
  onComplete,
  hasPrevious,
  hasNext,
}) {
  const buttons = [
    {
      text: "Skip Tour",
      classes: "shepherd-button-secondary",
      action: onSkip,
    },
  ];

  if (hasPrevious) {
    buttons.push({
      text: "Back",
      classes: "shepherd-button-secondary",
      action: onPreviousRoute,
    });
  }

  buttons.push({
    text: hasNext ? "Next Page" : "Finish",
    action: hasNext ? onNextRoute : onComplete,
  });

  return buttons;
}

export default function OwnerWorkflowTour({ user }) {
  const pathname = usePathname();
  const router = useRouter();
  const tourRef = useRef(null);
  const isNavigatingRef = useRef(false);
  const suppressCancelFinalizeRef = useRef(false);
  const [restartNonce, setRestartNonce] = useState(0);

  const isOwner = user?.role === "owner" || user?.role === "user";

  useEffect(() => {
    if (!isOwner) return undefined;

    const handleRestartTour = () => {
      setTourCompleted(false);
      writeTourState({ active: true, index: 0 });

      // If we are already on the first route, force a rerun immediately.
      setRestartNonce((prev) => prev + 1);

      if (pathname !== ROUTE_FLOW[0]) {
        router.push(ROUTE_FLOW[0]);
      }
    };

    window.addEventListener("owner-tour-start", handleRestartTour);
    return () => {
      window.removeEventListener("owner-tour-start", handleRestartTour);
    };
  }, [isOwner, pathname, router]);

  useEffect(() => {
    if (!isOwner || !pathname) return undefined;

    let disposed = false;

    const destroyExistingTour = () => {
      if (tourRef.current) {
        suppressCancelFinalizeRef.current = true;
        tourRef.current.cancel();
        tourRef.current = null;
      }
    };

    const runTourForCurrentRoute = async (routeIndex) => {
      if (disposed) return;

      const route = ROUTE_FLOW[routeIndex];
      if (route !== pathname) return;

      const { default: Shepherd } = await import("shepherd.js");
      if (disposed) return;

      destroyExistingTour();

      const routeConfig = ROUTE_STEP_CONFIG[pathname] || {
        title: "Owner Workflow",
        text: "Continue to the next page in your guided workflow.",
      };

      const hasPrevious = routeIndex > 0;
      const hasNext = routeIndex < ROUTE_FLOW.length - 1;

      const tour = new Shepherd.Tour({
        useModalOverlay: true,
        defaultStepOptions: {
          classes: "owner-tour-step",
          scrollTo: { behavior: "smooth", block: "center" },
          cancelIcon: {
            enabled: true,
            label: "Skip tour",
          },
        },
      });

      const finishTour = () => {
        clearTourState();
        setTourCompleted(true);
      };

      const skipTour = () => {
        isNavigatingRef.current = false;
        finishTour();
        suppressCancelFinalizeRef.current = true;
        tour.cancel();
      };

      const moveToRoute = (nextIndex) => {
        if (nextIndex < 0 || nextIndex >= ROUTE_FLOW.length) return;
        isNavigatingRef.current = true;
        writeTourState({ active: true, index: nextIndex });
        suppressCancelFinalizeRef.current = true;
        tour.cancel();
        router.push(ROUTE_FLOW[nextIndex]);
      };

      const step = {
        id: `owner-workflow-${pathname.replace(/\//g, "-") || "root"}`,
        title: routeConfig.title,
        text: routeConfig.text,
        buttons: buildStepButtons({
          hasPrevious,
          hasNext,
          onSkip: skipTour,
          onPreviousRoute: () => moveToRoute(routeIndex - 1),
          onNextRoute: () => moveToRoute(routeIndex + 1),
          onComplete: () => {
            isNavigatingRef.current = false;
            finishTour();
            tour.complete();
          },
        }),
      };

      if (routeConfig.attachTo && document.querySelector(routeConfig.attachTo)) {
        step.attachTo = {
          element: routeConfig.attachTo,
          on: "right",
        };
      }

      tour.addStep(step);

      tour.on("cancel", () => {
        if (suppressCancelFinalizeRef.current) {
          suppressCancelFinalizeRef.current = false;
          return;
        }

        if (isNavigatingRef.current) {
          isNavigatingRef.current = false;
          return;
        }

        finishTour();
      });

      tour.on("complete", () => {
        finishTour();
      });

      tourRef.current = tour;

      setTimeout(() => {
        if (!disposed) {
          tour.start();
        }
      }, 180);
    };

    const routeIndex = ROUTE_FLOW.indexOf(pathname);
    if (routeIndex === -1) return undefined;

    const persistedState = readTourState();

    if (persistedState?.active && persistedState.index === routeIndex) {
      runTourForCurrentRoute(routeIndex);
      return () => {
        disposed = true;
      };
    }

    // Auto-start only one time ever (unless user explicitly clicks Show Tour Again).
    if (!isTourCompleted() && routeIndex === 0) {
      writeTourState({ active: true, index: 0 });
      runTourForCurrentRoute(0);
      return () => {
        disposed = true;
      };
    }

    return () => {
      disposed = true;
    };
  }, [isOwner, pathname, restartNonce, router]);

  useEffect(() => {
    return () => {
      if (tourRef.current) {
        tourRef.current.cancel();
        tourRef.current = null;
      }
    };
  }, []);

  return null;
}
