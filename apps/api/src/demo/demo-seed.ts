import {
  applicationSchema,
  branchSchema,
  tenantSchema,
  type Application,
  type Branch,
  type Tenant,
} from "@opencori/contracts";

export const DEMO_CONFIGURATION_KEY_ID = "wema-demo-config-key-01";
export const DEMO_CONFIGURATION_VERSION = "wema-alat-demo-2026-08-03.1";

export const DEMO_CONFIGURATION_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIGZx+gLNqqcoHPUpwK9b4dURcN3YvbiYAcMFEvAiWQuG
-----END PRIVATE KEY-----
`;

export const DEMO_CONFIGURATION_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAWYQE8a+46opfHikf4YS37/SAOnbipZZD5qlcL0rlRaI=
-----END PUBLIC KEY-----
`;

export const WEMA_DEMO_ENCRYPTION_KEY_ID = "wema-demo-encryption-key-01";
export const WEMA_DEMO_ENCRYPTION_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtvJx2gO/wGILiucFGhnI
n6IRnRPYe0tSS+SO2Bs5UsjVib08wtfmnp2X0jV9oz7+3CXVc+UM2AxG2zTeORqG
BovrHfv3OqXjqZ6E14xiFBTYYq31Jz/3VzBAM7qvwSTSRZQH13BRh4Ayn7dSinko
KrGEaj5mFhialyr8NW8PPyYHxMo7qOZ1Fa0jFMIGYg1eu8kX7rKCWu5RoIbTSGmj
CCv7BBKDGITaorf5AdcxfTIhTmNsWeH1+SwbhpKab/9HAravW9J0VNnYXenAqerI
5oISj9Z/7VX86Nr7OabvByw7cRH1MKQuiVt3K4F9iS/MyQXT8/IncpJhVnataCTS
GQIDAQAB
-----END PUBLIC KEY-----
`;

const seededAt = "2026-08-03T00:00:00.000Z";
const missingAddress = "Address unavailable in cited public source";
const sortCodeSource = "https://purpleconnect.wemabank.com/support/solutions/folders/67000566977";
const sortCodeSourcePageTwo =
  "https://purpleconnect.wemabank.com/support/solutions/folders/67000566977/page/2";

export const wemaDemoTenant: Tenant = tenantSchema.parse({
  id: "wema",
  name: "Wema Bank",
  demo: true,
  createdAt: seededAt,
  updatedAt: seededAt,
});

export const alatDemoApplication: Application = applicationSchema.parse({
  id: "alat-demo",
  tenantId: "wema",
  name: "ALAT Demo",
  publicApplicationKey: "corri_demo_public_application_key_not_for_production",
  configurationSigningKeyId: DEMO_CONFIGURATION_KEY_ID,
  configurationSigningPublicKey: DEMO_CONFIGURATION_PUBLIC_KEY,
  receiverEncryptionKeyId: WEMA_DEMO_ENCRYPTION_KEY_ID,
  receiverEncryptionPublicKey: WEMA_DEMO_ENCRYPTION_PUBLIC_KEY,
  active: true,
  demo: true,
  createdAt: seededAt,
  updatedAt: seededAt,
});

interface MissingCoordinateBranch {
  id: string;
  externalBranchId: string;
  name: string;
  city: string;
  stateOrRegion: string;
  source: string;
}

function branchWithoutCoordinates(input: MissingCoordinateBranch): Branch {
  return branchSchema.parse({
    id: input.id,
    tenantId: "wema",
    externalBranchId: input.externalBranchId,
    name: input.name,
    branchType: "BRANCH",
    addressLine1: missingAddress,
    addressLine2: null,
    city: input.city,
    stateOrRegion: input.stateOrRegion,
    postalCode: null,
    countryCode: "NG",
    timeZone: "Africa/Lagos",
    latitude: null,
    longitude: null,
    coordinateQuality: "MISSING",
    approachRadiusMeters: 250,
    visitRadiusMeters: 100,
    exitRadiusMeters: 150,
    active: true,
    source: input.source,
    sourceVersion: "official-support-pages-2022-01-17",
    verifiedAt: null,
    metadata: {
      demoData: true,
      sourceScope: "Branch name, state and sort code only",
      productionEligible: false,
    },
    createdAt: seededAt,
    updatedAt: seededAt,
  });
}

export const wemaDemoBranches: readonly Branch[] = [
  branchSchema.parse({
    id: "wema_marina",
    tenantId: "wema",
    externalBranchId: "WEMA-MARINA-DEMO",
    name: "Wema Marina",
    branchType: "BRANCH",
    addressLine1: "54 Marina",
    addressLine2: null,
    city: "Lagos Island",
    stateOrRegion: "Lagos",
    postalCode: null,
    countryCode: "NG",
    timeZone: "Africa/Lagos",
    latitude: 6.45,
    longitude: 3.395,
    coordinateQuality: "ESTIMATED",
    approachRadiusMeters: 250,
    visitRadiusMeters: 100,
    exitRadiusMeters: 150,
    active: true,
    source: "https://www.wemabank.com/contact-us",
    sourceVersion: "retrieved-2026-08-03",
    verifiedAt: null,
    metadata: {
      demoData: true,
      coordinateProvenance: "Demo-only approximation; not bank-verified",
      addressProvenance: "Wema official contact page",
      productionEligible: false,
    },
    createdAt: seededAt,
    updatedAt: seededAt,
  }),
  branchWithoutCoordinates({
    id: "wema_aba",
    externalBranchId: "035210544",
    name: "Aba Branch",
    city: "Aba",
    stateOrRegion: "Abia",
    source: sortCodeSource,
  }),
  branchWithoutCoordinates({
    id: "wema_abuja_cbd",
    externalBranchId: "035080778",
    name: "Abuja CBD",
    city: "Abuja",
    stateOrRegion: "Federal Capital Territory",
    source: sortCodeSource,
  }),
  branchWithoutCoordinates({
    id: "wema_uyo",
    externalBranchId: "035011158",
    name: "Uyo",
    city: "Uyo",
    stateOrRegion: "Akwa Ibom",
    source: sortCodeSource,
  }),
  branchWithoutCoordinates({
    id: "wema_bauchi",
    externalBranchId: "035031138",
    name: "Bauchi",
    city: "Bauchi",
    stateOrRegion: "Bauchi",
    source: sortCodeSource,
  }),
  branchWithoutCoordinates({
    id: "wema_yenagoa",
    externalBranchId: "035321505",
    name: "Yenagoa",
    city: "Yenagoa",
    stateOrRegion: "Bayelsa",
    source: sortCodeSource,
  }),
  branchWithoutCoordinates({
    id: "wema_asaba",
    externalBranchId: "035241724",
    name: "Asaba",
    city: "Asaba",
    stateOrRegion: "Delta",
    source: sortCodeSource,
  }),
  branchWithoutCoordinates({
    id: "wema_kaduna",
    externalBranchId: "035111430",
    name: "Kaduna",
    city: "Kaduna",
    stateOrRegion: "Kaduna",
    source: sortCodeSourcePageTwo,
  }),
  branchWithoutCoordinates({
    id: "wema_kano",
    externalBranchId: "035120382",
    name: "Kano",
    city: "Kano",
    stateOrRegion: "Kano",
    source: sortCodeSourcePageTwo,
  }),
  branchWithoutCoordinates({
    id: "wema_lokoja",
    externalBranchId: "035282068",
    name: "Lokoja",
    city: "Lokoja",
    stateOrRegion: "Kogi",
    source: sortCodeSourcePageTwo,
  }),
];
