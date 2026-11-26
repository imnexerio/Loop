/**
 * Tag type registry
 *
 * Single source of truth for everything that differs between tag types:
 * labels, icons, value validation and display formatting. Components should
 * read from here instead of switching on `tag.type` themselves, so adding a
 * new tag type only means adding one entry.
 */

import { Tag, TagType } from '../types'

export interface ClockValue {
  hour: number
  minute: number
}

export interface TagTypeMeta {
  /** Name of the type, e.g. "Yes/No" */
  label: string
  /** Plural name used when grouping tags of this type, e.g. "Habits" */
  groupLabel: string
  icon: string
  /** Description of the type given to the AI assistant */
  describeForAI: (tag: Tag) => string
  /** True when a stored value is a real entry for this type */
  isValue: (value: unknown) => boolean
  /** Human-readable value */
  format: (tag: Tag, value: unknown) => string
}

export const isClockValue = (value: unknown): value is ClockValue =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as ClockValue).hour === 'number' &&
  typeof (value as ClockValue).minute === 'number'

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

export const formatClock = (hour: number, minute: number) =>
  `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`

/** Format minutes since midnight (any integer, wraps around) as HH:MM */
export const formatMinutesOfDay = (minutes: number) => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440
  return formatClock(Math.floor(m / 60), m % 60)
}

export const getRatingMax = (tag: Tag) => tag.config?.max || 5

export const TAG_TYPES: Record<TagType, TagTypeMeta> = {
  checkbox: {
    label: 'Yes/No',
    groupLabel: 'Habits',
    icon: '✓',
    describeForAI: () => 'Yes/No',
    isValue: (value) => typeof value === 'boolean',
    format: (_tag, value) => (value ? '✓' : '✗'),
  },
  number: {
    label: 'Number',
    groupLabel: 'Numbers',
    icon: '🔢',
    describeForAI: (tag) => `Number${tag.config?.unit ? ` in ${tag.config.unit}` : ''}`,
    isValue: isFiniteNumber,
    format: (tag, value) => `${value}${tag.config?.unit ? ' ' + tag.config.unit : ''}`,
  },
  rating: {
    label: 'Rating',
    groupLabel: 'Ratings',
    icon: '⭐',
    describeForAI: (tag) => `Rating (1-${getRatingMax(tag)})`,
    isValue: isFiniteNumber,
    format: (tag, value) => `${value}/${getRatingMax(tag)}`,
  },
  clocktime: {
    label: 'Clock Time',
    groupLabel: 'Times',
    icon: '🕐',
    describeForAI: () => 'Clock Time (HH:MM)',
    isValue: isClockValue,
    format: (_tag, value) =>
      isClockValue(value) ? formatClock(value.hour, value.minute) : String(value),
  },
  text: {
    label: 'Text',
    groupLabel: 'Notes',
    icon: '📝',
    describeForAI: () => 'Text',
    isValue: (value) => typeof value === 'string' && value.trim().length > 0,
    format: (_tag, value) => String(value),
  },
}

/** Display order for type groups */
export const TAG_TYPE_ORDER: TagType[] = ['checkbox', 'number', 'rating', 'clocktime', 'text']

const FALLBACK_META: TagTypeMeta = {
  label: 'Unknown',
  groupLabel: 'Other',
  icon: '📊',
  describeForAI: () => 'Unknown',
  isValue: (value) => value !== undefined && value !== null,
  format: (_tag, value) => String(value),
}

export const getTagTypeMeta = (type: TagType): TagTypeMeta => TAG_TYPES[type] ?? FALLBACK_META

export const formatTagValue = (tag: Tag, value: unknown): string =>
  getTagTypeMeta(tag.type).format(tag, value)
