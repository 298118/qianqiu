const WORLD_PEOPLE_LIFECYCLE_CONFIG = Object.freeze({
  maxNpcChangesPerStep: 4,
  maxHouseholdChangesPerStep: 4,
  maxAssetChangesPerStep: 3,
  maxEstateChangesPerStep: 3,
  maxRelationshipChangesPerStep: 5,
  maxMarriagePairsPerStep: 1,
  maxPublicEventsPerStep: 4,
  maxRecentRelationshipNotes: 8,

  annualAgeMonth: 1,
  minMarriageAge: 18,
  maxMarriageAge: 46,

  seniorAge: 55,
  elderAge: 70,
  fragileAge: 80,
  deathHealthThreshold: 6,
  lowHealthThreshold: 35,
  stableHealthTarget: 68,

  lowPublicOrderThreshold: 45,
  crisisPublicOrderThreshold: 35,
  stablePublicOrderThreshold: 70,
  highCorruptionThreshold: 70,
  highTaxThreshold: 55,
  grainStressRatio: 0.08,
  stableGrainRatio: 0.16,

  harvestMonths: Object.freeze([8, 9, 10]),
  monthlyIncomeDivisor: 12,
  maxNpcCashDelta: 60,
  maxNpcDebtDelta: 35,
  debtPressureCashGap: 80,

  lowWaterworksThreshold: 35,
  highTaxBurdenThreshold: 60,
  estateDisputeRiskThreshold: 55,
  estateSeriousDisputeRiskThreshold: 75,
  maxEstateRentDelta: 40,

  householdHighDebtPressure: 55,
  householdHighFamilyRisk: 60,
  relationshipObligationDecay: 1,
  patronagePowerThreshold: 55,
  resentmentRiskThreshold: 45,
  strongRelationshipThreshold: 45
});

module.exports = {
  WORLD_PEOPLE_LIFECYCLE_CONFIG
};
