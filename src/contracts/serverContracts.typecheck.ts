import type {
  GameTurnResponse,
  RawLedgerExcludedWorldState,
  SafeRouteViews,
  SessionStorageAdapter
} from "./serverContracts";

declare const safeWorldState: RawLedgerExcludedWorldState;
declare const routeViews: SafeRouteViews;
declare const adapter: SessionStorageAdapter;

safeWorldState.sessionId;
routeViews.worldGeographyView;
routeViews.roleWorldCouplingView;
routeViews.historicalEventArchiveView;
adapter.appendAuditEvent;
adapter.appendAiProposal;
adapter.listAuditEvents;
adapter.listAiProposals;

const forgedTurn: GameTurnResponse = {
  sessionId: "00000000-0000-0000-0000-000000000000",
  worldState: {
    sessionId: "00000000-0000-0000-0000-000000000000",
    // @ts-expect-error Game turn response worldState must reject raw ledger keys.
    actorMemoryLedger: {}
  }
};

void forgedTurn;
