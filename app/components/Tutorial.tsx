"use client";

import { useEffect, useState } from "react";
import { Joyride, EventData, STATUS, EVENTS, ACTIONS, Step } from "react-joyride";

export function Tutorial() {
  const [run, setRun] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Auto-start for first-time visitors
    const hasSeenTutorial = localStorage.getItem("hasSeenTutorial");
    if (!hasSeenTutorial) {
      // Slight delay to ensure elements have rendered
      setTimeout(() => setRun(true), 1000);
    }

    // Listen for manual trigger
    const handleStartTutorial = () => setRun(true);
    window.addEventListener('start-tutorial', handleStartTutorial);
    return () => window.removeEventListener('start-tutorial', handleStartTutorial);
  }, []);

  const steps: Step[] = [
    {
      target: "body",
      placement: "center",
      title: "Welcome to Summer Game Map!",
      content: "This tool helps you explore and track AADL Summer Game codes. Let's take a quick tour.",
      skipBeacon: true,
    },
    {
      target: "#tour-map",
      title: "Interactive Map",
      content: "Click on any dot on the map to mark it as found or entered. Note that you still need to manually enter the code on the official Summer Game site, as we have no way of doing that for you. Once you do, you can check it off as entered here.",
      placement: "center",
    },
    {
      target: "#tour-filters",
      title: "Map Filters",
      content: "Use these toggles to show or hide Business, Home, and Badge codes. You can also hide codes you've already checked off.",
    },
    {
      target: "#tour-found",
      title: "Tracking Progress",
      content: "View your 'Found' list, mark codes as entered on the AADL site, and add private notes.",
    },
    {
      target: "#tour-route",
      title: "Route Builder",
      content: "Enable the Route Builder to plan the most efficient path between multiple codes you want to visit.",
    },
    {
      target: "#tour-sync",
      title: "Sync & Backup",
      content: "Join a group to share your progress. More importantly, frequently backup your data from this menu to prevent losing your progress if your browser data is cleared!",
    },
    {
      target: "#tour-bug-report",
      title: "Found a Bug?",
      content: "If you encounter any issues, you can report them here to help improve the map for everyone.",
    }
  ];

  const handleJoyrideCallback = (data: EventData) => {
    const { status, type, action, index } = data;

    // Switch tabs on mobile preemptively before Joyride searches for the next target
    if (type === EVENTS.STEP_AFTER || type === EVENTS.TOUR_START) {
      let nextIndex = index;
      if (type === EVENTS.STEP_AFTER) {
        if (action === ACTIONS.NEXT) nextIndex = index + 1;
        else if (action === ACTIONS.PREV) nextIndex = index - 1;
      }
      
      if (nextIndex >= 0 && nextIndex < steps.length) {
        const nextTarget = steps[nextIndex].target;
        window.dispatchEvent(new CustomEvent('tour-step-before', { detail: { target: nextTarget } }));
      }
    }

    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      localStorage.setItem("hasSeenTutorial", "true");
      setRun(false);
    }
  };


  if (!mounted) return null;

  return (
    <Joyride
      onEvent={handleJoyrideCallback}
      continuous
      run={run}
      scrollToFirstStep
      steps={steps}
      options={{
        zIndex: 10000,
        primaryColor: '#2563eb', // blue-600
        showProgress: true,
        buttons: ['back', 'primary', 'skip'],
      }}
    />
  );
}
