export const mockDemoRoles = [
  {
    role_code: "admin",
    name: "管理員",
    description: "系統管理員",
  },
  {
    role_code: "procurement",
    name: "採購",
    description: "採購人員",
  },
  {
    role_code: "calibration",
    name: "儀校",
    description: "儀校人員",
  },
  {
    role_code: "calibration_boss",
    name: "儀校主管",
    description: "儀校主管",
  },
  {
    role_code: "calibration-tpe",
    name: "TPE儀校",
    description: "TPE儀校",
  },
];

export const mockDemoRolePermissions = {
  admin: {
    modules: [
      "Procurement",
      "Calibration",
      "Calibration_boss",
      "Calibration-TPE",
    ],
    forms: [],
    attachments: [],
  },
  procurement: {
    modules: ["Procurement"],
    forms: [],
    attachments: [],
  },
  calibration: {
    modules: ["Calibration"],
    forms: [],
    attachments: [],
  },
  calibration_boss: {
    modules: ["Calibration_boss", "Calibration"],
    forms: [],
    attachments: [],
  },
  "calibration-tpe": {
    modules: ["Calibration-TPE"],
    forms: [],
    attachments: [],
  },
};

export const getMockDemoRoles = () =>
  mockDemoRoles.map((role) => ({ ...role }));

export const getMockDemoRolePermissions = (roleCode) => {
  const permissions = mockDemoRolePermissions[roleCode];

  if (!permissions) return null;

  return {
    modules: [...permissions.modules],
    forms: permissions.forms.map((permission) => ({ ...permission })),
    attachments: permissions.attachments.map((permission) => ({
      ...permission,
    })),
  };
};

export const getMockDemoRolesPermissions = (roleCodes) => {
  const permissionsList = roleCodes
    .map(getMockDemoRolePermissions)
    .filter(Boolean);
  const uniqueObjects = (items) => [
    ...new Map(items.map((item) => [JSON.stringify(item), item])).values(),
  ];

  return {
    modules: [
      ...new Set(permissionsList.flatMap((permissions) => permissions.modules)),
    ],
    forms: uniqueObjects(
      permissionsList.flatMap((permissions) => permissions.forms),
    ),
    attachments: uniqueObjects(
      permissionsList.flatMap((permissions) => permissions.attachments),
    ),
  };
};
