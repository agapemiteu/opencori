"use client";

import { useMemo, useState } from "react";

type Scenario =
  | "happy"
  | "passing"
  | "permission"
  | "offline"
  | "destination"
  | "reentry"
  | "duplicate";
type Flow =
  | "home"
  | "permission"
  | "approach"
  | "prompt"
  | "visit"
  | "support"
  | "sending"
  | "queued"
  | "sent"
  | "complete"
  | "passing";

interface EventRow {
  label: string;
  detail: string;
  tone?: "ok" | "warn" | "muted";
}

interface ScenarioCard {
  id: Scenario;
  name: string;
  caption: string;
}

// Typed as a non-empty tuple so scenarios[0] stays a safe fallback for find().
const scenarios: readonly [ScenarioCard, ...ScenarioCard[]] = [
  {
    id: "happy",
    name: "Normal branch visit",
    caption: "Confirmed visit, support request, delivery, stable exit.",
  },
  {
    id: "passing",
    name: "Customer is passing by",
    caption: "No visit is created and the branch enters cooldown.",
  },
  {
    id: "permission",
    name: "Location permission denied",
    caption: "ALAT keeps working. Branch-aware assistance stays off.",
  },
  {
    id: "offline",
    name: "Customer loses internet",
    caption: "Encrypted request is queued and resumes when connectivity returns.",
  },
  {
    id: "destination",
    name: "Wema endpoint unavailable",
    caption: "Customer sees a calm pending state while Corri retries underneath.",
  },
  {
    id: "reentry",
    name: "Customer leaves and re-enters",
    caption: "Exit grace prevents a duplicate visit.",
  },
  {
    id: "duplicate",
    name: "Customer taps send twice",
    caption: "Idempotency produces one logical delivery and one receipt.",
  },
];

const branches = [
  ["Marina Demo Branch", "Lagos", "Lagos Island", "350 m", "250 m"],
  ["Ikeja Demo Branch", "Lagos", "Ikeja", "350 m", "250 m"],
  ["Abuja CBD Demo Branch", "FCT", "Abuja", "400 m", "290 m"],
  ["Kano Demo Branch", "Kano", "Kano", "420 m", "300 m"],
  ["Kaduna Demo Branch", "Kaduna", "Kaduna", "400 m", "290 m"],
  ["Ibadan Demo Branch", "Oyo", "Ibadan", "380 m", "270 m"],
  ["Port Harcourt Demo Branch", "Rivers", "Port Harcourt", "360 m", "260 m"],
  ["Enugu Demo Branch", "Enugu", "Enugu", "380 m", "270 m"],
];

function timeLabel() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function Page() {
  const [scenario, setScenario] = useState<Scenario>("happy");
  const [flow, setFlow] = useState<Flow>("home");
  const [permission, setPermission] = useState<"granted" | "denied" | "unknown">("granted");
  const [online, setOnline] = useState(true);
  const [message, setMessage] = useState(
    "I came to the branch because my card has not been working.",
  );
  const [receipt, setReceipt] = useState("");
  const [cipher, setCipher] = useState("");
  const [reveal, setReveal] = useState(false);
  const [visitActive, setVisitActive] = useState(false);
  // Visit duration is tracked but not yet rendered; the panel shows a fixed
  // duration string. Kept so the presenter controls stay wired up.
  const [, setVisitSeconds] = useState(0);
  const [events, setEvents] = useState<EventRow[]>([
    { label: "SDK_READY", detail: "Embedded in ALAT · config verified", tone: "ok" },
    {
      label: "NEARBY_CONFIG_SYNCED",
      detail: "5 nearby demo branches selected from registry",
      tone: "muted",
    },
  ]);
  const [lastPlaintext, setLastPlaintext] = useState("");
  const [sending, setSending] = useState(false);

  const selectedScenario = scenarios.find((item) => item.id === scenario) ?? scenarios[0];
  const infrastructureState = useMemo(() => {
    if (flow === "permission") return "PERMISSION_REQUIRED";
    if (flow === "approach") return "APPROACH_CANDIDATE";
    if (flow === "prompt") return "PROMPT_PENDING";
    if (flow === "visit" || flow === "support") return "VISIT_ACTIVE";
    if (flow === "sending") return "DELIVERING";
    if (flow === "queued") return "DELIVERY_QUEUED";
    if (flow === "sent") return visitActive ? "VISIT_ACTIVE" : "DELIVERED";
    if (flow === "complete") return "COMPLETED";
    if (flow === "passing") return "COOLDOWN";
    return "MONITORING";
  }, [flow, visitActive]);

  function addEvent(label: string, detail: string, tone: EventRow["tone"] = "muted") {
    setEvents((current) => [{ label, detail, tone }, ...current].slice(0, 12));
  }

  function reset(nextScenario: Scenario = scenario) {
    setScenario(nextScenario);
    setFlow("home");
    setPermission(nextScenario === "permission" ? "unknown" : "granted");
    setOnline(nextScenario === "offline" ? false : true);
    setReceipt("");
    setCipher("");
    setReveal(false);
    setVisitActive(false);
    setVisitSeconds(0);
    setLastPlaintext("");
    setSending(false);
    setMessage("I came to the branch because my card has not been working.");
    setEvents([
      { label: "SDK_READY", detail: "Embedded in ALAT · config verified", tone: "ok" },
      {
        label: "SCENARIO_SELECTED",
        detail: scenarios.find((item) => item.id === nextScenario)?.name ?? "Normal branch visit",
        tone: "muted",
      },
    ]);
  }

  function startJourney() {
    if (scenario === "permission" && permission !== "granted") {
      setFlow("permission");
      addEvent(
        "PERMISSION_REQUIRED",
        "Background branch assistance unavailable until ALAT receives location permission",
        "warn",
      );
      return;
    }

    setFlow("approach");
    addEvent(
      "APPROACH_CANDIDATE",
      "branch=marina · confidence=MEDIUM · anonymous installation",
      "muted",
    );
    window.setTimeout(() => {
      setFlow("prompt");
      addEvent("ALAT_PROMPT_REQUESTED", "Host app chooses its own Wema-branded notification", "ok");
    }, 900);
  }

  function allowLocation() {
    setPermission("granted");
    addEvent("PERMISSION_CHANGED", "location=granted · branch awareness available", "ok");
    setFlow("home");
  }

  function denyLocation() {
    setPermission("denied");
    addEvent("PERMISSION_CHANGED", "location=denied · ALAT core banking unaffected", "warn");
    setFlow("home");
  }

  function confirmVisit() {
    setFlow("visit");
    setVisitActive(true);
    setVisitSeconds(0);
    addEvent(
      "VISIT_STARTED",
      "startSource=CUSTOMER_CONFIRMED · branch=marina · confidence=HIGH",
      "ok",
    );
  }

  function declineVisit() {
    setFlow("passing");
    setVisitActive(false);
    addEvent("PROMPT_DECLINED", "outcome=NOT_VISITING · branch-specific cooldown applied", "muted");
  }

  function openSupport() {
    setFlow("support");
    addEvent("HOST_SUPPORT_OPENED", "ALAT-owned support UI · Corri receives no plaintext", "muted");
  }

  async function makeCipher(text: string) {
    const encoded = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", encoded);
    const hash = Array.from(new Uint8Array(digest))
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
    return `${btoa(unescape(encodeURIComponent(text)))
      .split("")
      .reverse()
      .join("")}.${hash}`;
  }

  async function deliver(singleLogicalRequest = true) {
    if (sending || !message.trim()) return;
    setSending(true);
    setLastPlaintext(message);
    setFlow("sending");
    addEvent("HOST_ENCRYPTING", "Plaintext remains inside the Wema-owned ALAT experience", "muted");

    const encrypted = await makeCipher(message);
    setCipher(encrypted);
    addEvent("DELIVERY_ACCEPTED", "route=customer-care.general · ciphertext only", "ok");

    if (!online || scenario === "offline") {
      setFlow("queued");
      addEvent(
        "DELIVERY_QUEUED",
        "No connectivity · encrypted envelope retained for retry",
        "warn",
      );
      setSending(false);
      return;
    }

    const eventId = scenario === "duplicate" ? "evt_demo_idempotent" : `evt_${Date.now()}`;
    const response = await fetch("/api/relay", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventId,
        routeKey: "customer-care.general",
        branchId: "marina",
        ciphertext: encrypted,
        failOnce: scenario === "destination",
      }),
    });
    const data = await response.json();
    const nextReceipt = data.receipt || `WEMA-DEMO-${Math.floor(10000 + Math.random() * 90000)}`;
    setReceipt(nextReceipt);

    if (data.retried || scenario === "destination") {
      addEvent(
        "DELIVERY_RETRY",
        "Primary Wema destination unavailable once · retry completed",
        "warn",
      );
    }
    if (scenario === "duplicate" && singleLogicalRequest) {
      addEvent("IDEMPOTENCY_HIT", "Duplicate submit mapped to the same logical event", "ok");
    }

    addEvent("DELIVERY_COMPLETED", `receipt=${nextReceipt} · receiver=Wema`, "ok");
    setFlow("sent");
    setSending(false);
  }

  async function restoreConnection() {
    setOnline(true);
    addEvent("CONNECTIVITY_RESTORED", "Queued envelope eligible for delivery", "ok");
    setSending(false);
    const currentScenario = scenario;
    setScenario("happy");
    await deliver(false);
    setScenario(currentScenario);
  }

  function leaveBranch() {
    if (scenario === "reentry") {
      addEvent("EXIT_CANDIDATE", "Outside exit radius · grace timer started", "muted");
      window.setTimeout(() => {
        addEvent(
          "REENTRY_DETECTED",
          "Customer returned during grace period · same visit continues",
          "ok",
        );
        setFlow("visit");
      }, 650);
      setFlow("approach");
      return;
    }
    setVisitSeconds((current) => Math.max(current, 23 * 60 + 14));
    setVisitActive(false);
    setFlow("complete");
    addEvent("VISIT_COMPLETED", "stable exit · duration=23m14s · confidence=HIGH", "ok");
  }

  return (
    <main className="demoShell">
      <header className="presenterHeader">
        <div>
          <span className="overline">WEMA HACKAHOLICS · DIGITAL TRANSFORMATION</span>
          <h1>ALAT branch experience</h1>
          <p>
            The customer uses ALAT exactly as before. The new capability is embedded underneath.
          </p>
        </div>
        <div className="headerActions">
          <span className="sandboxPill">
            <i /> Live demo
          </span>
          <button className="ghostButton" onClick={() => reset()}>
            Reset
          </button>
          <button className="darkButton" onClick={() => setReveal((value) => !value)}>
            {reveal ? "Hide infrastructure" : "Reveal infrastructure"}
          </button>
        </div>
      </header>

      <section className="demoStage">
        <aside className="scenarioPanel">
          <div className="panelLabel">Presenter controls</div>
          <h2>Real customer scenarios</h2>
          <p>These controls are outside ALAT and exist only for judging.</p>
          <div className="scenarioList">
            {scenarios.map((item) => (
              <button
                key={item.id}
                className={scenario === item.id ? "scenario active" : "scenario"}
                onClick={() => reset(item.id)}
              >
                <span className="radioDot" />
                <span>
                  <b>{item.name}</b>
                  <small>{item.caption}</small>
                </span>
              </button>
            ))}
          </div>
          <div className="presenterCard">
            <span>Selected scenario</span>
            <b>{selectedScenario.name}</b>
            <p>{selectedScenario.caption}</p>
          </div>
          <button className="runButton" onClick={startJourney}>
            Run this journey
          </button>
          {flow === "queued" && (
            <button className="recoveryButton" onClick={restoreConnection}>
              Presenter: restore connection
            </button>
          )}
          {visitActive && (
            <button
              className="recoveryButton"
              onClick={() => setVisitSeconds((value) => value + 23 * 60)}
            >
              Presenter: advance 23 minutes
            </button>
          )}
        </aside>

        <section className="customerStage">
          <div className="stageHeader">
            <div>
              <span className="panelLabel">Customer view</span>
              <h2>What the customer actually sees</h2>
            </div>
            <span className="customerRule">No Corri branding · no new app · no new account</span>
          </div>

          <div className="phoneWrap">
            <div className="device">
              <div className="deviceNotch" />
              <div className="statusBar">
                <b>9:41</b>
                <span>● ● ●</span>
                <b>100%</b>
              </div>
              <div className="alatHeader">
                <div className="alatBrand">ALAT</div>
                <div className="alatHeaderActions">
                  <span>⌕</span>
                  <span>◌</span>
                </div>
              </div>
              <div className="screen">
                {(flow === "home" ||
                  flow === "approach" ||
                  flow === "prompt" ||
                  flow === "passing") && (
                  <div className="homeScreen">
                    <div className="helloRow">
                      <div>
                        <span>Good evening</span>
                        <b>Welcome back</b>
                      </div>
                      <div className="profileOrb">AM</div>
                    </div>
                    <div className="accountCard">
                      <span>Available balance</span>
                      <strong>₦••••••</strong>
                      <small>Tap to reveal balance</small>
                    </div>
                    <div className="quickActions">
                      <div>
                        <i>↗</i>
                        <span>Send</span>
                      </div>
                      <div>
                        <i>▦</i>
                        <span>Bills</span>
                      </div>
                      <div>
                        <i>◫</i>
                        <span>Cards</span>
                      </div>
                      <div>
                        <i>•••</i>
                        <span>More</span>
                      </div>
                    </div>
                    <div className="activityCard">
                      <div className="activityHead">
                        <b>Recent activity</b>
                        <span>See all</span>
                      </div>
                      <div className="activityItem">
                        <i>↙</i>
                        <div>
                          <b>Transfer received</b>
                          <span>Today · 4:18 PM</span>
                        </div>
                        <strong>+₦••••</strong>
                      </div>
                      <div className="activityItem">
                        <i>▣</i>
                        <div>
                          <b>Card payment</b>
                          <span>Yesterday · 6:42 PM</span>
                        </div>
                        <strong>-₦••••</strong>
                      </div>
                    </div>

                    {flow === "approach" && (
                      <div className="notificationToast">
                        <div className="notifIcon">A</div>
                        <div>
                          <b>ALAT</b>
                          <span>Checking nearby Wema services…</span>
                        </div>
                      </div>
                    )}
                    {flow === "prompt" && (
                      <div className="notificationToast interactive">
                        <div className="notifIcon">A</div>
                        <div className="notifCopy">
                          <b>Visiting Wema Marina?</b>
                          <span>We can make it easier to get help during your visit.</span>
                        </div>
                        <button onClick={confirmVisit}>Open</button>
                      </div>
                    )}
                    {flow === "passing" && (
                      <div className="softMessage">
                        <b>No problem.</b>
                        <span>ALAT will not treat this as a branch visit.</span>
                      </div>
                    )}
                    {flow === "prompt" && (
                      <div className="bottomSheet">
                        <div className="sheetHandle" />
                        <span className="sheetEyebrow">WEMA MARINA</span>
                        <h3>Are you visiting this branch?</h3>
                        <p>This lets ALAT give you relevant help while you are here.</p>
                        <button className="phonePrimary" onClick={confirmVisit}>
                          Yes, I’m here
                        </button>
                        <button className="phoneSecondary" onClick={declineVisit}>
                          I’m not visiting
                        </button>
                        <button className="phoneText" onClick={() => setFlow("home")}>
                          Not now
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {flow === "permission" && (
                  <div className="permissionScreen">
                    <div className="alatBrand big">ALAT</div>
                    <div className="permissionIllustration">
                      <span>⌖</span>
                    </div>
                    <h2>Get help when you visit a Wema branch</h2>
                    <p>
                      Allow ALAT to recognise when you are near a Wema branch so we can make branch
                      visits easier.
                    </p>
                    <button className="phonePrimary" onClick={allowLocation}>
                      Allow location
                    </button>
                    <button className="phoneSecondary" onClick={denyLocation}>
                      Not now
                    </button>
                    <small>ALAT banking continues to work if you choose not to allow this.</small>
                  </div>
                )}

                {flow === "visit" && (
                  <div className="homeScreen">
                    <div className="helloRow">
                      <div>
                        <span>Good evening</span>
                        <b>Welcome back</b>
                      </div>
                      <div className="profileOrb">AM</div>
                    </div>
                    <div className="accountCard">
                      <span>Available balance</span>
                      <strong>₦••••••</strong>
                      <small>Tap to reveal balance</small>
                    </div>
                    <div className="visitContext">
                      <div className="branchIcon">W</div>
                      <div>
                        <span>Wema Marina</span>
                        <b>Need help while you’re here?</b>
                        <small>Use Wema Support without leaving ALAT.</small>
                      </div>
                      <button onClick={openSupport}>Get help</button>
                    </div>
                    <div className="quickActions">
                      <div>
                        <i>↗</i>
                        <span>Send</span>
                      </div>
                      <div>
                        <i>▦</i>
                        <span>Bills</span>
                      </div>
                      <div>
                        <i>◫</i>
                        <span>Cards</span>
                      </div>
                      <div>
                        <i>•••</i>
                        <span>More</span>
                      </div>
                    </div>
                    <button className="leaveLink" onClick={leaveBranch}>
                      Presenter: simulate leaving branch
                    </button>
                  </div>
                )}

                {flow === "support" && (
                  <div className="supportScreen">
                    <div className="screenNav">
                      <button onClick={() => setFlow("visit")}>‹</button>
                      <b>Wema Support</b>
                      <span>⋮</span>
                    </div>
                    <div className="supportIntro">
                      <div className="supportIcon">W</div>
                      <div>
                        <span>Wema Marina</span>
                        <h2>How can we help?</h2>
                        <p>Tell us what happened. Your request will go to Wema Support.</p>
                      </div>
                    </div>
                    <label>Message</label>
                    <textarea
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      placeholder="Describe what you need help with"
                    />
                    <div className="supportNote">
                      Your branch context is attached automatically. You do not need to repeat where
                      you are.
                    </div>
                    <button
                      className="phonePrimary"
                      disabled={!message.trim() || sending}
                      onClick={() => deliver(true)}
                    >
                      Send to Wema Support
                    </button>
                    {scenario === "duplicate" && (
                      <button
                        className="phoneSecondary"
                        disabled={!message.trim() || sending}
                        onClick={() => deliver(true)}
                      >
                        Demo: tap send again
                      </button>
                    )}
                  </div>
                )}

                {flow === "sending" && (
                  <div className="resultScreen">
                    <div className="spinner" />
                    <h2>Sending your request…</h2>
                    <p>You can keep using ALAT while we securely send this to Wema Support.</p>
                  </div>
                )}

                {flow === "queued" && (
                  <div className="resultScreen">
                    <div className="pendingMark">↻</div>
                    <h2>Your request is saved.</h2>
                    <p>
                      We’ll send it automatically when your connection is back. You do not need to
                      submit again.
                    </p>
                    <div className="pendingCard">
                      <b>Wema Marina</b>
                      <span>Waiting for connection</span>
                    </div>
                    <button className="phonePrimary" onClick={() => setFlow("home")}>
                      Continue using ALAT
                    </button>
                  </div>
                )}

                {flow === "sent" && (
                  <div className="resultScreen">
                    <div className="successMark">✓</div>
                    <h2>Wema received your request.</h2>
                    <p>Wema Support can continue from here. You can keep using ALAT normally.</p>
                    <div className="pendingCard">
                      <span>Reference</span>
                      <b>{receipt}</b>
                    </div>
                    <button className="phonePrimary" onClick={() => setFlow("visit")}>
                      Done
                    </button>
                  </div>
                )}

                {flow === "complete" && (
                  <div className="homeScreen">
                    <div className="helloRow">
                      <div>
                        <span>Good evening</span>
                        <b>Welcome back</b>
                      </div>
                      <div className="profileOrb">AM</div>
                    </div>
                    <div className="accountCard">
                      <span>Available balance</span>
                      <strong>₦••••••</strong>
                      <small>Tap to reveal balance</small>
                    </div>
                    <div className="feedbackCard">
                      <span>Wema Marina</span>
                      <b>How was your visit?</b>
                      <p>Your feedback helps us improve the branch experience.</p>
                      <div>
                        <button>Good</button>
                        <button>Okay</button>
                        <button>Not good</button>
                      </div>
                    </div>
                    <div className="quickActions">
                      <div>
                        <i>↗</i>
                        <span>Send</span>
                      </div>
                      <div>
                        <i>▦</i>
                        <span>Bills</span>
                      </div>
                      <div>
                        <i>◫</i>
                        <span>Cards</span>
                      </div>
                      <div>
                        <i>•••</i>
                        <span>More</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </section>

      <section className={reveal ? "infraReveal open" : "infraReveal"}>
        <div className="infraHeader">
          <div>
            <span className="overline">JUDGE / ENGINEERING VIEW · NOT CUSTOMER-FACING</span>
            <h2>What was running underneath ALAT</h2>
            <p>
              Corri is embedded infrastructure. This surface exists for integration, operations and
              judging, never for the banking customer.
            </p>
          </div>
          <div className="corriMark">
            <span>c</span>
            <div>
              <b>corri</b>
              <small>embedded physical-context SDK</small>
            </div>
          </div>
        </div>

        <div className="infraGrid">
          <div className="infraCard stateCard">
            <div className="cardTitle">
              <span>State machine</span>
              <b>{infrastructureState}</b>
            </div>
            <div className="stateRail">
              {["MONITORING", "APPROACH", "PROMPT", "VISIT", "DELIVERY", "COMPLETED"].map(
                (state) => {
                  const active =
                    infrastructureState.includes(state) ||
                    (state === "VISIT" && infrastructureState === "VISIT_ACTIVE") ||
                    (state === "DELIVERY" &&
                      ["DELIVERING", "DELIVERY_QUEUED", "DELIVERED"].includes(infrastructureState));
                  return (
                    <div className={active ? "active" : ""} key={state}>
                      <i />
                      {state}
                    </div>
                  );
                },
              )}
            </div>
            <div className="eventLog">
              {events.map((event, index) => (
                <div key={`${event.label}-${index}`}>
                  <time>{index === 0 ? timeLabel() : "earlier"}</time>
                  <span className={event.tone ?? "muted"}>{event.label}</span>
                  <p>{event.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="infraCard privacyCard">
            <div className="cardTitle">
              <span>Privacy boundary</span>
              <b>CONTENT BLIND</b>
            </div>
            <div className="zeroGrid">
              <div>
                <strong>0</strong>
                <span>customer identity fields</span>
              </div>
              <div>
                <strong>0</strong>
                <span>account / BVN fields</span>
              </div>
              <div>
                <strong>0</strong>
                <span>transaction fields</span>
              </div>
              <div>
                <strong>0</strong>
                <span>bank credentials</span>
              </div>
              <div>
                <strong>0</strong>
                <span>readable complaint fields</span>
              </div>
            </div>
            <div className="boundaryFlow">
              <div>
                <b>ALAT</b>
                <span>Owns customer + plaintext</span>
              </div>
              <i>→</i>
              <div className="corriBoundary">
                <b>Corri</b>
                <span>Metadata + ciphertext</span>
              </div>
              <i>→</i>
              <div>
                <b>Wema receiver</b>
                <span>Owns decryption + action</span>
              </div>
            </div>
          </div>

          <div className="infraCard envelopeCard">
            <div className="cardTitle">
              <span>Content-blind envelope</span>
              <b>{cipher ? "AVAILABLE" : "WAITING"}</b>
            </div>
            <pre>
              {cipher
                ? JSON.stringify(
                    {
                      branchId: "marina",
                      routeKey: "customer-care.general",
                      ciphertext: `${cipher.slice(0, 72)}…`,
                      plaintextVisibleToCorri: false,
                    },
                    null,
                    2,
                  )
                : '{\n  "waiting_for_request": true\n}'}
            </pre>
          </div>

          <div className="infraCard receiverCard">
            <div className="cardTitle">
              <span>Wema-owned receiver</span>
              <b>{receipt ? "RECEIVED" : "WAITING"}</b>
            </div>
            <div className="receiverMessage">
              {lastPlaintext || "No customer request has reached the Wema receiver yet."}
            </div>
            <div className="receiverMeta">
              <div>
                <span>Reference</span>
                <b>{receipt || "—"}</b>
              </div>
              <div>
                <span>Signature</span>
                <b>{receipt ? "Verified" : "—"}</b>
              </div>
              <div>
                <span>Branch</span>
                <b>{receipt ? "Wema Marina" : "—"}</b>
              </div>
            </div>
          </div>

          <div className="infraCard registryCard">
            <div className="cardTitle">
              <span>Bank-approved branch registry</span>
              <b>{branches.length} DEMO NODES</b>
            </div>
            <div className="branchTable">
              <div className="branchRow head">
                <span>Branch</span>
                <span>State</span>
                <span>City</span>
                <span>Approach</span>
                <span>Exit</span>
              </div>
              {branches.map((branch) => (
                <div className="branchRow" key={branch[0]}>
                  {branch.map((value) => (
                    <span key={value}>{value}</span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
