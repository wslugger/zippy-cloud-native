'use client';

import { memo, useCallback, useEffect, useReducer, useRef } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type FieldType = 'string' | 'number' | 'boolean' | 'enum';
type JsonScalar = string | number | boolean | null;

interface EnumOption {
  value: string;
  label: string;
}

interface FieldDef {
  id: string;
  key: string;
  title: string;
  type: FieldType;
  description?: string;
  defaultValue?: string;
  required: boolean;
  options: EnumOption[];
}

interface SchemaProperty {
  type?: 'string' | 'number' | 'boolean';
  title?: string;
  description?: string;
  enum?: string[];
  enumLabels?: string[];
  default?: JsonScalar;
}

interface JsonObjectSchema {
  type: 'object';
  properties: Record<string, SchemaProperty>;
  required?: string[];
}

interface ConfigSchemaBuilderProps {
  value?: unknown;
  onChange: (schema: JsonObjectSchema | null) => void;
}

function createFieldId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `field-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function parseSchema(input: unknown): JsonObjectSchema | null {
  if (!isRecord(input)) return null;
  const type = input.type;
  const properties = input.properties;
  if (type !== 'object') return null;
  if (!isRecord(properties)) return null;

  const requiredRaw = input.required;
  const required = Array.isArray(requiredRaw)
    ? requiredRaw.filter((entry): entry is string => typeof entry === 'string')
    : undefined;

  const parsedProperties: Record<string, SchemaProperty> = {};
  for (const [key, rawProp] of Object.entries(properties)) {
    if (!isRecord(rawProp)) continue;

    const enumValues = Array.isArray(rawProp.enum)
      ? rawProp.enum.filter((entry): entry is string => typeof entry === 'string')
      : undefined;
    const enumLabels = Array.isArray(rawProp.enumLabels)
      ? rawProp.enumLabels.filter((entry): entry is string => typeof entry === 'string')
      : undefined;
    const typeValue =
      rawProp.type === 'string' || rawProp.type === 'number' || rawProp.type === 'boolean'
        ? rawProp.type
        : undefined;

    const defaultValue =
      typeof rawProp.default === 'string' ||
      typeof rawProp.default === 'number' ||
      typeof rawProp.default === 'boolean' ||
      rawProp.default === null
        ? rawProp.default
        : undefined;

    parsedProperties[key] = {
      type: typeValue,
      title: typeof rawProp.title === 'string' ? rawProp.title : undefined,
      description: typeof rawProp.description === 'string' ? rawProp.description : undefined,
      enum: enumValues,
      enumLabels,
      default: defaultValue,
    };
  }

  return {
    type: 'object',
    properties: parsedProperties,
    ...(required && required.length > 0 ? { required } : {}),
  };
}

function fieldToSchema(field: FieldDef): SchemaProperty {
  const property: SchemaProperty = { type: field.type === 'enum' ? 'string' : field.type };
  if (field.title) property.title = field.title;
  if (field.description) property.description = field.description;
  if (field.type === 'enum' && field.options.length > 0) {
    property.enum = field.options.map((option) => option.value);
    property.enumLabels = field.options.map((option) => option.label);
  }
  if (field.defaultValue !== undefined && field.defaultValue !== '') {
    property.default =
      field.type === 'number'
        ? Number(field.defaultValue)
        : field.type === 'boolean'
          ? field.defaultValue === 'true'
          : field.defaultValue;
  }
  return property;
}

function schemaToFields(input: unknown): FieldDef[] {
  const schema = parseSchema(input);
  if (!schema) return [];
  const requiredKeys = new Set(schema.required ?? []);
  return Object.entries(schema.properties).map(([key, property]) => ({
    id: createFieldId(),
    key,
    title: property.title ?? key,
    type: property.enum ? 'enum' : (property.type ?? 'string'),
    description: property.description ?? '',
    defaultValue: property.default !== undefined && property.default !== null ? String(property.default) : '',
    required: requiredKeys.has(key),
    options: property.enum
      ? property.enum.map((value, index) => ({
          value,
          label: property.enumLabels?.[index] ?? value,
        }))
      : [],
  }));
}

function fieldsToSchema(fields: FieldDef[]): JsonObjectSchema {
  const properties: Record<string, SchemaProperty> = {};
  const required: string[] = [];
  for (const field of fields) {
    if (!field.key) continue;
    properties[field.key] = fieldToSchema(field);
    if (field.required) required.push(field.key);
  }
  return { type: 'object', properties, ...(required.length > 0 ? { required } : {}) };
}

function emptyField(): FieldDef {
  return {
    id: createFieldId(),
    key: '',
    title: '',
    type: 'string',
    description: '',
    defaultValue: '',
    required: false,
    options: [],
  };
}

interface FieldCardProps {
  field: FieldDef;
  onPatchField: (fieldId: string, patch: Partial<FieldDef>) => void;
  onMoveField: (fieldId: string, dir: -1 | 1) => void;
  onRemoveField: (fieldId: string) => void;
  onAddOption: (fieldId: string) => void;
  onPatchOption: (fieldId: string, optionIndex: number, patch: Partial<EnumOption>) => void;
  onRemoveOption: (fieldId: string, optionIndex: number) => void;
}

const FieldCard = memo(function FieldCard({
  field,
  onPatchField,
  onMoveField,
  onRemoveField,
  onAddOption,
  onPatchOption,
  onRemoveOption,
}: FieldCardProps) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <GripVertical size={14} className="text-slate-700 shrink-0" />
        <div className="grid grid-cols-2 gap-2 flex-1">
          <Input
            placeholder="key (e.g. topology)"
            value={field.key}
            onChange={(event) => onPatchField(field.id, { key: event.target.value })}
            className="bg-white text-xs font-mono"
          />
          <Input
            placeholder="Title (e.g. Topology)"
            value={field.title}
            onChange={(event) => onPatchField(field.id, { title: event.target.value })}
            className="bg-white text-xs"
          />
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => onMoveField(field.id, -1)} className="p-1 text-slate-600 hover:text-slate-300">
            <ChevronUp size={14} />
          </button>
          <button onClick={() => onMoveField(field.id, 1)} className="p-1 text-slate-600 hover:text-slate-300">
            <ChevronDown size={14} />
          </button>
          <button onClick={() => onRemoveField(field.id)} className="p-1 text-slate-600 hover:text-red-400">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <label className="text-[9px] uppercase font-bold tracking-widest text-slate-600">Type</label>
          <select
            value={field.type}
            onChange={(event) =>
              onPatchField(field.id, {
                type: event.target.value as FieldType,
                options: [],
                defaultValue: '',
              })
            }
            className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-700 outline-none"
          >
            <option value="string">String</option>
            <option value="number">Number</option>
            <option value="boolean">Boolean</option>
            <option value="enum">Dropdown</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[9px] uppercase font-bold tracking-widest text-slate-600">Default</label>
          {field.type === 'boolean' ? (
            <select
              value={field.defaultValue}
              onChange={(event) => onPatchField(field.id, { defaultValue: event.target.value })}
              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-700 outline-none"
            >
              <option value="">None</option>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          ) : (
            <Input
              placeholder="Default value"
              value={field.defaultValue}
              onChange={(event) => onPatchField(field.id, { defaultValue: event.target.value })}
              className="bg-white text-xs"
            />
          )}
        </div>
        <div className="space-y-1">
          <label className="text-[9px] uppercase font-bold tracking-widest text-slate-600">Required</label>
          <div className="flex items-center h-9">
            <button
              type="button"
              onClick={() => onPatchField(field.id, { required: !field.required })}
              className={`relative w-10 h-5 rounded-full transition-colors ${field.required ? 'bg-blue-600' : 'bg-slate-200'}`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${field.required ? 'translate-x-5' : 'translate-x-0.5'}`}
              />
            </button>
          </div>
        </div>
      </div>

      <Input
        placeholder="Description (optional)"
        value={field.description}
        onChange={(event) => onPatchField(field.id, { description: event.target.value })}
        className="bg-white text-xs"
      />

      {field.type === 'enum' && (
        <div className="space-y-2">
          <label className="text-[9px] uppercase font-bold tracking-widest text-slate-600">Options</label>
          {field.options.map((option, optionIndex) => (
            <div key={`${field.id}-${optionIndex}`} className="flex gap-2 items-center">
              <Input
                placeholder="value"
                value={option.value}
                onChange={(event) => onPatchOption(field.id, optionIndex, { value: event.target.value })}
                className="bg-white text-xs font-mono flex-1"
              />
              <Input
                placeholder="label"
                value={option.label}
                onChange={(event) => onPatchOption(field.id, optionIndex, { label: event.target.value })}
                className="bg-white text-xs flex-1"
              />
              <button onClick={() => onRemoveOption(field.id, optionIndex)} className="text-slate-600 hover:text-red-400 shrink-0">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onAddOption(field.id)}
            className="text-xs text-blue-500 hover:text-blue-400 flex items-center gap-1"
          >
            <Plus size={12} /> Add option
          </button>
        </div>
      )}
    </div>
  );
});

export function ConfigSchemaBuilder({ value, onChange }: ConfigSchemaBuilderProps) {
  const [fields, dispatch] = useReducer(
    (_current: FieldDef[], next: FieldDef[]) => next,
    value,
    schemaToFields,
  );
  const fieldsRef = useRef<FieldDef[]>(fields);

  useEffect(() => {
    const next = schemaToFields(value);
    fieldsRef.current = next;
    dispatch(next);
  }, [value]);

  const commitFields = useCallback(
    (nextFields: FieldDef[]) => {
      fieldsRef.current = nextFields;
      dispatch(nextFields);
      const schema = fieldsToSchema(nextFields);
      onChange(Object.keys(schema.properties).length > 0 ? schema : null);
    },
    [onChange],
  );

  const updateFields = useCallback(
    (updater: (current: FieldDef[]) => FieldDef[]) => {
      const next = updater(fieldsRef.current);
      commitFields(next);
    },
    [commitFields],
  );

  const addField = useCallback(() => {
    updateFields((current) => [...current, emptyField()]);
  }, [updateFields]);

  const removeField = useCallback(
    (fieldId: string) => {
      updateFields((current) => current.filter((field) => field.id !== fieldId));
    },
    [updateFields],
  );

  const moveField = useCallback(
    (fieldId: string, dir: -1 | 1) => {
      updateFields((current) => {
        const index = current.findIndex((field) => field.id === fieldId);
        if (index < 0) return current;
        const nextIndex = index + dir;
        if (nextIndex < 0 || nextIndex >= current.length) return current;
        const next = [...current];
        [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
        return next;
      });
    },
    [updateFields],
  );

  const patchField = useCallback(
    (fieldId: string, patch: Partial<FieldDef>) => {
      updateFields((current) =>
        current.map((field) => (field.id === fieldId ? { ...field, ...patch } : field)),
      );
    },
    [updateFields],
  );

  const addOption = useCallback(
    (fieldId: string) => {
      updateFields((current) =>
        current.map((field) =>
          field.id === fieldId
            ? { ...field, options: [...field.options, { value: '', label: '' }] }
            : field,
        ),
      );
    },
    [updateFields],
  );

  const patchOption = useCallback(
    (fieldId: string, optionIndex: number, patch: Partial<EnumOption>) => {
      updateFields((current) =>
        current.map((field) => {
          if (field.id !== fieldId) return field;
          const options = field.options.map((option, index) =>
            index === optionIndex ? { ...option, ...patch } : option,
          );
          return { ...field, options };
        }),
      );
    },
    [updateFields],
  );

  const removeOption = useCallback(
    (fieldId: string, optionIndex: number) => {
      updateFields((current) =>
        current.map((field) =>
          field.id === fieldId
            ? { ...field, options: field.options.filter((_, index) => index !== optionIndex) }
            : field,
        ),
      );
    },
    [updateFields],
  );

  return (
    <div className="space-y-3">
      {fields.length === 0 && (
        <div className="text-center py-6 text-slate-600 text-sm border-2 border-dashed border-slate-200 rounded-xl">
          No fields defined. Add one below.
        </div>
      )}

      {fields.map((field) => (
        <FieldCard
          key={field.id}
          field={field}
          onPatchField={patchField}
          onMoveField={moveField}
          onRemoveField={removeField}
          onAddOption={addOption}
          onPatchOption={patchOption}
          onRemoveOption={removeOption}
        />
      ))}

      <Button type="button" variant="ghost" onClick={addField} className="w-full border border-dashed border-slate-300 text-slate-500 hover:text-slate-900 gap-2">
        <Plus size={14} /> Add Field
      </Button>
    </div>
  );
}
