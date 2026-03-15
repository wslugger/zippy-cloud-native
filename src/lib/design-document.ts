import { ItemType, Prisma, type DesignDocumentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const SERVICE_OPTION_DEPENDENCY_TYPES = new Set([
  "OPTIONAL_ATTACHMENT",
  "MANDATORY_ATTACHMENT",
  "INCLUDES",
  "REQUIRES",
]);

const PACKAGE_FEATURE_STATUSES = new Set(["REQUIRED", "STANDARD", "OPTIONAL"] as const);

type PackageFeatureStatus = "REQUIRED" | "STANDARD" | "OPTIONAL";

type FeatureStatus = "AVAILABLE" | "NOT_AVAILABLE" | PackageFeatureStatus;

const CONFIGURABLE_SERVICE_TYPES = new Set<ItemType>([
  ItemType.MANAGED_SERVICE,
  ItemType.CONNECTIVITY,
  ItemType.SERVICE_OPTION,
]);

const STANDALONE_SECTION_TYPES = new Set<ItemType>([
  ItemType.MANAGED_SERVICE,
  ItemType.CONNECTIVITY,
]);

interface JsonObject {
  [key: string]: Prisma.JsonValue;
}

interface AppendixCatalogItem {
  id: string;
  name: string;
  type: ItemType;
  shortDescription?: string | null;
  detailedDescription?: string | null;
  constraints: Array<{ description: string }>;
  assumptions: Array<{ description: string }>;
}

interface ServiceCatalogItem {
  id: string;
  sku: string;
  name: string;
  type: ItemType;
  shortDescription: string | null;
  detailedDescription: string | null;
  attributes: Array<{
    taxonomyTermId: string;
    term: { category: string; label: string; value: string; description: string | null; constraints: string[]; assumptions: string[] };
  }>;
  childDependencies: Array<{
    type: string;
    childItem: {
      id: string;
      type: ItemType;
      name: string;
      shortDescription: string | null;
      detailedDescription: string | null;
      constraints: Array<{ description: string }>;
      assumptions: Array<{ description: string }>;
      attributes: Array<{
        taxonomyTermId: string;
        term: { category: string; label: string; value: string; description: string | null; constraints: string[]; assumptions: string[] };
      }>;
    };
  }>;
  designOptions: Array<{
    isRequired: boolean;
    allowMulti: boolean;
    defaultValue: { value: string } | null;
    designOption: {
      key: string;
      label: string;
      description: string | null;
      constraints: string[];
      assumptions: string[];
      values: Array<{
        value: string;
        label: string;
        description: string | null;
        constraints: string[];
        assumptions: string[];
      }>;
    };
    allowedValues: Array<{
      designOptionValue: {
        value: string;
        label: string;
        description: string | null;
        constraints: string[];
        assumptions: string[];
      };
    }>;
  }>;
}

export interface DesignDocumentFeature {
  termId: string;
  label: string;
  status: FeatureStatus;
}

export interface DesignDocumentServiceOption {
  id: string;
  name: string;
  description: string | null;
  selected: boolean;
}

export interface DesignDocumentOptionValue {
  value: string;
  label: string;
}

export interface DesignDocumentDesignOption {
  key: string;
  label: string;
  required: boolean;
  allowMulti: boolean;
  selectedValues: DesignDocumentOptionValue[];
  availableValues: DesignDocumentOptionValue[];
}

export interface DesignDocumentServiceSection {
  kind: "SERVICE";
  catalogItemId: string;
  name: string;
  sku: string;
  itemType: ItemType;
  selected: boolean;
  description: string | null;
  serviceOptions: DesignDocumentServiceOption[];
  designOptions: DesignDocumentDesignOption[];
  features: DesignDocumentFeature[];
}

export interface DesignDocumentPackageSection {
  kind: "PACKAGE";
  catalogItemId: string;
  name: string;
  sku: string;
  description: string | null;
  features: DesignDocumentFeature[];
  services: DesignDocumentServiceSection[];
}

export interface AppendixEntry {
  catalogItemId: string;
  name: string;
  itemType: string;
  description: string | null;
  features: Array<{ label: string; status: FeatureStatus }>;
  constraints: string[];
  assumptions: string[];
}

export interface DesignDocumentModel {
  projectId: string;
  projectName: string;
  customerName: string | null;
  title: string;
  executiveSummary: string;
  conclusions: string;
  sections: Array<DesignDocumentPackageSection | DesignDocumentServiceSection>;
  appendix: AppendixEntry[];
  generatedAt: string;
  document: {
    id: string;
    version: number;
    status: DesignDocumentStatus;
    updatedAt: string;
    generatorModel: string | null;
  };
}

type DraftDocument = {
  id: string;
  projectId: string;
  version: number;
  status: DesignDocumentStatus;
  title: string;
  executiveSummary: string | null;
  conclusions: string | null;
  generatorModel: string | null;
  updatedAt: Date;
};

type ProjectDocumentContext = Prisma.ProjectGetPayload<{
  include: {
    items: {
      include: {
        catalogItem: {
          include: {
            attributes: { include: { term: true } };
            assumptions: true;
            constraints: true;
            childDependencies: {
              include: {
                childItem: {
                  include: {
                    attributes: { include: { term: true } };
                    assumptions: true;
                    constraints: true;
                  };
                };
              };
            };
            designOptions: {
              include: {
                designOption: {
                  include: {
                    values: true;
                  };
                };
                allowedValues: {
                  include: {
                    designOptionValue: true;
                  };
                };
                defaultValue: true;
              };
            };
            packageCompositions: {
              include: {
                catalogItem: {
                  include: {
                    attributes: { include: { term: true } };
                    assumptions: true;
                    constraints: true;
                    childDependencies: {
                      include: {
                        childItem: {
                          include: {
                            attributes: { include: { term: true } };
                            assumptions: true;
                            constraints: true;
                          };
                        };
                      };
                    };
                    designOptions: {
                      include: {
                        designOption: {
                          include: {
                            values: true;
                          };
                        };
                        allowedValues: {
                          include: {
                            designOptionValue: true;
                          };
                        };
                        defaultValue: true;
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
    };
  };
}>;

function isJsonObject(value: Prisma.JsonValue | null | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStringArray(value: Prisma.JsonValue | undefined): string[] {
  if (typeof value === "string") return [value];
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function parseStringMap(value: Prisma.JsonValue | null | undefined): Record<string, Prisma.JsonValue> {
  if (!isJsonObject(value)) return {};
  return value;
}

function normalizeTextArray(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value) => value.length > 0)
    )
  );
}

function parsePackageFeatureAssignments(value: Prisma.JsonValue | null | undefined): Record<string, PackageFeatureStatus> {
  const config = parseStringMap(value);
  const raw = config.packageFeatureAssignments;
  if (!isJsonObject(raw)) return {};

  const assignments: Record<string, PackageFeatureStatus> = {};
  for (const [termId, status] of Object.entries(raw)) {
    if (typeof status === "string" && PACKAGE_FEATURE_STATUSES.has(status as PackageFeatureStatus)) {
      assignments[termId] = status as PackageFeatureStatus;
    }
  }
  return assignments;
}

function getFeatureTermsFromAttributes(attributes: Array<{ taxonomyTermId: string; term: { category: string; label: string; value: string } }>) {
  return attributes
    .filter((attribute) => attribute.term.category === "FEATURE")
    .map((attribute) => ({
      termId: attribute.taxonomyTermId,
      label: attribute.term.label || attribute.term.value,
    }))
    .filter((entry) => entry.label.length > 0);
}

function getFeatureDetailsFromAttributes(attributes: Array<{
  taxonomyTermId: string;
  term: { category: string; label: string; value: string; description: string | null; constraints: string[]; assumptions: string[] };
}>) {
  return attributes
    .filter((attribute) => attribute.term.category === "FEATURE")
    .map((attribute) => ({
      termId: attribute.taxonomyTermId,
      label: attribute.term.label || attribute.term.value,
      description: attribute.term.description,
      constraints: normalizeTextArray(attribute.term.constraints),
      assumptions: normalizeTextArray(attribute.term.assumptions),
    }))
    .filter((entry) => entry.label.length > 0);
}

function readOptionSelections(
  projectItem: { designOptionValues: Prisma.JsonValue | null; configValues: Prisma.JsonValue | null } | undefined,
  optionKey: string
): string[] {
  if (!projectItem) return [];
  const fromDesignOptionValues = parseStringMap(projectItem.designOptionValues)[optionKey];
  const fromConfigValues = parseStringMap(projectItem.configValues)[optionKey];
  const merged = [...toStringArray(fromDesignOptionValues), ...toStringArray(fromConfigValues)];
  return Array.from(new Set(merged));
}

function buildServiceSection(input: {
  catalogItem: ServiceCatalogItem;
  projectItem: ProjectDocumentContext["items"][number] | undefined;
  selectedCatalogItemIds: Set<string>;
  packageFeatureAssignments?: Record<string, PackageFeatureStatus>;
  packageFeatureLabels?: Map<string, string>;
  isExplicitlySelected: boolean;
}): DesignDocumentServiceSection {
  const {
    catalogItem,
    projectItem,
    selectedCatalogItemIds,
    packageFeatureAssignments,
    packageFeatureLabels,
    isExplicitlySelected,
  } = input;

  const serviceOptions = catalogItem.childDependencies
    .filter((dependency) => SERVICE_OPTION_DEPENDENCY_TYPES.has(dependency.type))
    .filter((dependency) => dependency.childItem.type === ItemType.SERVICE_OPTION)
    .map((dependency) => ({
      id: dependency.childItem.id,
      name: dependency.childItem.name,
      description: dependency.childItem.shortDescription,
      selected: selectedCatalogItemIds.has(dependency.childItem.id),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const designOptions = catalogItem.designOptions
    .map((optionAssignment) => {
      const optionValues = optionAssignment.allowedValues.length > 0
        ? optionAssignment.allowedValues.map((row) => row.designOptionValue)
        : optionAssignment.designOption.values;

      const selectedRawValues = readOptionSelections(projectItem, optionAssignment.designOption.key);
      const effectiveValues = selectedRawValues.length > 0
        ? selectedRawValues
        : optionAssignment.defaultValue
          ? [optionAssignment.defaultValue.value]
          : [];

      const valueLabelMap = new Map(optionValues.map((value) => [value.value, value.label || value.value]));

      return {
        key: optionAssignment.designOption.key,
        label: optionAssignment.designOption.label || optionAssignment.designOption.key,
        required: optionAssignment.isRequired,
        allowMulti: optionAssignment.allowMulti,
        selectedValues: effectiveValues.map((value) => ({ value, label: valueLabelMap.get(value) ?? value })),
        availableValues: optionValues.map((value) => ({ value: value.value, label: value.label || value.value })),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  const serviceFeatures = getFeatureTermsFromAttributes(catalogItem.attributes);

  let features: DesignDocumentFeature[];
  if (packageFeatureAssignments) {
    if (serviceFeatures.length > 0) {
      features = serviceFeatures
        .map((feature) => ({
          termId: feature.termId,
          label: feature.label,
          status: packageFeatureAssignments[feature.termId] ?? "STANDARD",
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
    } else {
      // Fallback for packages where feature assignments are configured but member services
      // do not have explicit feature attributes attached.
      features = Object.entries(packageFeatureAssignments)
        .map(([termId, status]) => {
          const label = packageFeatureLabels?.get(termId);
          if (!label) return null;
          return { termId, label, status } as DesignDocumentFeature;
        })
        .filter((feature): feature is DesignDocumentFeature => Boolean(feature))
        .sort((a, b) => a.label.localeCompare(b.label));
    }
  } else {
    features = serviceFeatures
      .map((feature) => ({
        termId: feature.termId,
        label: feature.label,
        status: "STANDARD" as const,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  return {
    kind: "SERVICE",
    catalogItemId: catalogItem.id,
    name: catalogItem.name,
    sku: catalogItem.sku,
    itemType: catalogItem.type,
    selected: isExplicitlySelected,
    description: catalogItem.detailedDescription || catalogItem.shortDescription,
    serviceOptions,
    designOptions,
    features,
  };
}

function getDefaultExecutiveSummary(projectName: string, sections: Array<DesignDocumentPackageSection | DesignDocumentServiceSection>): string {
  const packageCount = sections.filter((section) => section.kind === "PACKAGE").length;
  const serviceCount = sections.reduce((count, section) => {
    if (section.kind === "PACKAGE") return count + section.services.length;
    return count + 1;
  }, 0);

  return `This design document outlines the selected architecture for ${projectName}. It includes ${packageCount} package selections and ${serviceCount} configured services, with catalog-aligned design options and feature coverage for implementation planning.`;
}

function getDefaultConclusions(projectName: string): string {
  return `The recommended design for ${projectName} is ready for downstream BOM and commercial validation. Service choices, design options, and fixed feature statuses are aligned to catalog definitions and package policies.`;
}

export async function loadOrCreateDraftDesignDocument(projectId: string): Promise<DraftDocument> {
  const draft = await prisma.projectDesignDocument.findFirst({
    where: { projectId, status: "DRAFT" },
    orderBy: [{ version: "desc" }, { updatedAt: "desc" }],
  });

  if (draft) {
    return draft;
  }

  const maxVersionRow = await prisma.projectDesignDocument.findFirst({
    where: { projectId },
    select: { version: true },
    orderBy: { version: "desc" },
  });

  return prisma.projectDesignDocument.create({
    data: {
      projectId,
      version: (maxVersionRow?.version ?? 0) + 1,
      status: "DRAFT",
      title: "Design Document",
    },
  });
}

async function loadProjectDocumentContext(projectId: string, userId: string): Promise<ProjectDocumentContext | null> {
  return prisma.project.findFirst({
    where: { id: projectId, userId },
    include: {
      items: {
        include: {
          catalogItem: {
            include: {
              attributes: { include: { term: true } },
              assumptions: true,
              constraints: true,
              childDependencies: {
                include: {
                  childItem: {
                    include: {
                      attributes: { include: { term: true } },
                      assumptions: true,
                      constraints: true,
                    },
                  },
                },
              },
              designOptions: {
                include: {
                  designOption: {
                    include: {
                      values: {
                        where: { isActive: true },
                        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
                      },
                    },
                  },
                  allowedValues: {
                    include: {
                      designOptionValue: true,
                    },
                  },
                  defaultValue: true,
                },
              },
              packageCompositions: {
                include: {
                  catalogItem: {
                    include: {
                      attributes: { include: { term: true } },
                      assumptions: true,
                      constraints: true,
                      childDependencies: {
                        include: {
                          childItem: {
                            include: {
                              attributes: { include: { term: true } },
                              assumptions: true,
                              constraints: true,
                            },
                          },
                        },
                      },
                      designOptions: {
                        include: {
                          designOption: {
                            include: {
                              values: {
                                where: { isActive: true },
                                orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
                              },
                            },
                          },
                          allowedValues: {
                            include: {
                              designOptionValue: true,
                            },
                          },
                          defaultValue: true,
                        },
                      },
                    },
                  },
                },
                orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function buildDesignDocumentModel(params: {
  projectId: string;
  userId: string;
  draft?: DraftDocument;
}): Promise<DesignDocumentModel | null> {
  const { projectId, userId } = params;
  const project = await loadProjectDocumentContext(projectId, userId);
  if (!project) return null;

  const draft = params.draft ?? (await loadOrCreateDraftDesignDocument(projectId));

  const selectedByCatalogItemId = new Map(project.items.map((item) => [item.catalogItemId, item]));
  const selectedCatalogItemIds = new Set(selectedByCatalogItemId.keys());

  const selectedPackages = project.items.filter((item) => item.catalogItem.type === ItemType.PACKAGE);

  const packageMemberMap = new Map<string, string>();
  for (const packageItem of selectedPackages) {
    for (const member of packageItem.catalogItem.packageCompositions) {
      packageMemberMap.set(member.catalogItemId, packageItem.catalogItemId);
    }
  }

  const sections: Array<DesignDocumentPackageSection | DesignDocumentServiceSection> = [];
  const appendixMap = new Map<string, AppendixEntry>();

  const addAppendixEntry = (
    catalogItem: AppendixCatalogItem,
    extra?: Partial<Pick<AppendixEntry, "description" | "features">>
  ) => {
    const nextEntry: AppendixEntry = {
      catalogItemId: catalogItem.id,
      name: catalogItem.name,
      itemType: catalogItem.type,
      description: extra?.description ?? catalogItem.detailedDescription ?? catalogItem.shortDescription ?? null,
      features: extra?.features ?? [],
      constraints: normalizeTextArray(catalogItem.constraints.map((row) => row.description)),
      assumptions: normalizeTextArray(catalogItem.assumptions.map((row) => row.description)),
    };

    const existing = appendixMap.get(catalogItem.id);
    if (!existing) {
      appendixMap.set(catalogItem.id, nextEntry);
      return;
    }

    appendixMap.set(catalogItem.id, {
      ...existing,
      description: existing.description || nextEntry.description,
      features: existing.features.length > 0 ? existing.features : nextEntry.features,
      constraints: existing.constraints.length > 0 ? existing.constraints : nextEntry.constraints,
      assumptions: existing.assumptions.length > 0 ? existing.assumptions : nextEntry.assumptions,
    });
  };

  const addFeatureAppendixEntry = (feature: {
    termId: string;
    label: string;
    status: FeatureStatus;
    description: string | null;
    constraints: string[];
    assumptions: string[];
  }) => {
    const entryId = `feature:${feature.termId}`;
    const existing = appendixMap.get(entryId);
    const nextFeature = { label: feature.label, status: feature.status };

    appendixMap.set(entryId, {
      catalogItemId: entryId,
      name: feature.label,
      itemType: "FEATURE",
      description: feature.description,
      features: existing?.features?.length ? existing.features : [nextFeature],
      constraints: existing?.constraints?.length ? existing.constraints : feature.constraints,
      assumptions: existing?.assumptions?.length ? existing.assumptions : feature.assumptions,
    });
  };

  const addDesignOptionAppendixEntry = (params: {
    serviceCatalogItemId: string;
    serviceName: string;
    option: DesignDocumentDesignOption;
    source: ServiceCatalogItem["designOptions"][number];
  }) => {
    const { serviceCatalogItemId, serviceName, option, source } = params;
    const entryId = `design-option:${serviceCatalogItemId}:${option.key}`;

    const selectedValueSet = new Set(option.selectedValues.map((value) => value.value));
    const selectedValueDetails = source.designOption.values.filter((value) => selectedValueSet.has(value.value));

    const descriptions = normalizeTextArray([
      source.designOption.description,
      ...selectedValueDetails.map((value) => value.description),
    ]);
    const constraints = normalizeTextArray([
      ...source.designOption.constraints,
      ...selectedValueDetails.flatMap((value) => value.constraints),
    ]);
    const assumptions = normalizeTextArray([
      ...source.designOption.assumptions,
      ...selectedValueDetails.flatMap((value) => value.assumptions),
    ]);

    appendixMap.set(entryId, {
      catalogItemId: entryId,
      name: `${option.label} (${serviceName})`,
      itemType: "DESIGN_OPTION",
      description: descriptions.length > 0 ? descriptions.join(" ") : null,
      features: [],
      constraints,
      assumptions,
    });
  };

  for (const packageItem of selectedPackages) {
    const packageFeaturesFromMembers = new Map<string, string>();
    for (const compositionRow of packageItem.catalogItem.packageCompositions) {
      const memberFeatures = getFeatureTermsFromAttributes(compositionRow.catalogItem.attributes);
      for (const feature of memberFeatures) {
        packageFeaturesFromMembers.set(feature.termId, feature.label);
      }
    }

    const featureAssignments = parsePackageFeatureAssignments(packageItem.catalogItem.configSchema);

    const packageFeatures: DesignDocumentFeature[] = Array.from(packageFeaturesFromMembers.entries())
      .map(([termId, label]) => ({
        termId,
        label,
        status: featureAssignments[termId] ?? "STANDARD",
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const services = packageItem.catalogItem.packageCompositions
      .filter((row) => CONFIGURABLE_SERVICE_TYPES.has(row.catalogItem.type))
      .filter((row) => row.role !== "OPTIONAL" || selectedCatalogItemIds.has(row.catalogItemId))
      .map((row) => {
        const selectedProjectItem = selectedByCatalogItemId.get(row.catalogItemId);
        return buildServiceSection({
          catalogItem: row.catalogItem,
          projectItem: selectedProjectItem,
          selectedCatalogItemIds,
          packageFeatureAssignments: featureAssignments,
          packageFeatureLabels: packageFeaturesFromMembers,
          isExplicitlySelected: row.role !== "OPTIONAL" || Boolean(selectedProjectItem),
        });
      });

    addAppendixEntry(packageItem.catalogItem);
    for (const service of services) {
      const serviceCatalogItem = packageItem.catalogItem.packageCompositions.find((row) => row.catalogItemId === service.catalogItemId)?.catalogItem;
      if (serviceCatalogItem) {
        addAppendixEntry(serviceCatalogItem, { features: service.features });

        const selectedServiceOptionIds = new Set(
          service.serviceOptions.filter((option) => option.selected).map((option) => option.id)
        );
        for (const dependency of serviceCatalogItem.childDependencies) {
          if (dependency.childItem.type !== ItemType.SERVICE_OPTION) continue;
          if (!selectedServiceOptionIds.has(dependency.childItem.id)) continue;
          addAppendixEntry(dependency.childItem);
        }

        const designOptionSourceByKey = new Map(
          serviceCatalogItem.designOptions.map((assignment) => [assignment.designOption.key, assignment])
        );
        for (const option of service.designOptions) {
          const source = designOptionSourceByKey.get(option.key);
          if (!source) continue;
          addDesignOptionAppendixEntry({
            serviceCatalogItemId: serviceCatalogItem.id,
            serviceName: serviceCatalogItem.name,
            option,
            source,
          });
        }

        const featureDetailsByTermId = new Map(
          getFeatureDetailsFromAttributes(serviceCatalogItem.attributes).map((feature) => [feature.termId, feature])
        );
        for (const feature of service.features) {
          const detail = featureDetailsByTermId.get(feature.termId);
          addFeatureAppendixEntry({
            termId: feature.termId,
            label: feature.label,
            status: feature.status,
            description: detail?.description ?? null,
            constraints: detail?.constraints ?? [],
            assumptions: detail?.assumptions ?? [],
          });
        }
      }
    }

    sections.push({
      kind: "PACKAGE",
      catalogItemId: packageItem.catalogItemId,
      name: packageItem.catalogItem.name,
      sku: packageItem.catalogItem.sku,
      description: packageItem.catalogItem.detailedDescription || packageItem.catalogItem.shortDescription,
      features: packageFeatures,
      services,
    });
  }

  const standaloneServices = project.items
    .filter((item) => STANDALONE_SECTION_TYPES.has(item.catalogItem.type))
    .filter((item) => !packageMemberMap.has(item.catalogItemId))
    .map((item) => {
      const section = buildServiceSection({
        catalogItem: item.catalogItem,
        projectItem: item,
        selectedCatalogItemIds,
        isExplicitlySelected: true,
      });

      addAppendixEntry(item.catalogItem, { features: section.features });
      const selectedServiceOptionIds = new Set(
        section.serviceOptions.filter((option) => option.selected).map((option) => option.id)
      );
      for (const dependency of item.catalogItem.childDependencies) {
        if (dependency.childItem.type !== ItemType.SERVICE_OPTION) continue;
        if (!selectedServiceOptionIds.has(dependency.childItem.id)) continue;
        addAppendixEntry(dependency.childItem);
      }

      const designOptionSourceByKey = new Map(
        item.catalogItem.designOptions.map((assignment) => [assignment.designOption.key, assignment])
      );
      for (const option of section.designOptions) {
        const source = designOptionSourceByKey.get(option.key);
        if (!source) continue;
        addDesignOptionAppendixEntry({
          serviceCatalogItemId: item.catalogItem.id,
          serviceName: item.catalogItem.name,
          option,
          source,
        });
      }

      const featureDetailsByTermId = new Map(
        getFeatureDetailsFromAttributes(item.catalogItem.attributes).map((feature) => [feature.termId, feature])
      );
      for (const feature of section.features) {
        const detail = featureDetailsByTermId.get(feature.termId);
        addFeatureAppendixEntry({
          termId: feature.termId,
          label: feature.label,
          status: feature.status,
          description: detail?.description ?? null,
          constraints: detail?.constraints ?? [],
          assumptions: detail?.assumptions ?? [],
        });
      }
      return section;
    });

  sections.push(...standaloneServices);

  return {
    projectId: project.id,
    projectName: project.name,
    customerName: project.customerName,
    title: draft.title,
    executiveSummary: draft.executiveSummary?.trim() || getDefaultExecutiveSummary(project.name, sections),
    conclusions: draft.conclusions?.trim() || getDefaultConclusions(project.name),
    sections,
    appendix: Array.from(appendixMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    generatedAt: new Date().toISOString(),
    document: {
      id: draft.id,
      version: draft.version,
      status: draft.status,
      updatedAt: draft.updatedAt.toISOString(),
      generatorModel: draft.generatorModel,
    },
  };
}

export async function updateDraftDesignDocument(input: {
  projectId: string;
  title?: string;
  executiveSummary?: string;
  conclusions?: string;
  generatorModel?: string | null;
  generationMeta?: Prisma.InputJsonValue;
}): Promise<DraftDocument> {
  const draft = await loadOrCreateDraftDesignDocument(input.projectId);

  return prisma.projectDesignDocument.update({
    where: { id: draft.id },
    data: {
      ...(typeof input.title === "string" ? { title: input.title } : {}),
      ...(typeof input.executiveSummary === "string" ? { executiveSummary: input.executiveSummary } : {}),
      ...(typeof input.conclusions === "string" ? { conclusions: input.conclusions } : {}),
      ...(typeof input.generatorModel === "string" || input.generatorModel === null
        ? { generatorModel: input.generatorModel }
        : {}),
      ...(input.generationMeta ? { generationMeta: input.generationMeta } : {}),
    },
  });
}
