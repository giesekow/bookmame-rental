import { $FD, $FM, $PT, Api, Field } from 'vuetify-extended'

export type RentalMarketplaceAttributeDefinition = {
  id: string
  label: string
  description?: string | null
  dataType: string
  unitGroup?: string | null
  isRequired: boolean
  isVariantDefining: boolean
  categoryLabel: string
  options: Array<{ code: string; label: string }>
}

const definitions = new Map<string, RentalMarketplaceAttributeDefinition>()
const facetsByLabel = new Map<string, string>()
const selectedDefinitionByField = new WeakMap<Field, string>()

export async function resolveRentalCategoryFacetId(categoryLabel: unknown) {
  const label = String(categoryLabel || '').trim()
  if (!label) return undefined
  if (facetsByLabel.has(label)) return facetsByLabel.get(label)
  const response = await Api.instance.service('reference-data/marketplace-categories').find({
    query: { marketplace: 'rental', $paginate: false },
  }) as any
  const rows = Array.isArray(response) ? response : response?.data || []
  rows.forEach((row: any) => facetsByLabel.set(String(row.label), String(row.id)))
  return facetsByLabel.get(label)
}

function normalizeDate(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return value
  return new Date(value * 86_400_000).toISOString().slice(0, 10)
}

function valueLabel(row: any) {
  const definition = definitions.get(String(row.attributeDefinitionId || ''))
  if (['single_option', 'multiple_option'].includes(row.dataType)) {
    const selected = Array.isArray(row.optionValues) ? row.optionValues : [row.optionValues]
    const labels = new Map((definition?.options || []).map((option) => [option.code, option.label]))
    return selected.filter(Boolean).map((code: unknown) => labels.get(String(code)) || String(code)).join(', ')
  }
  if (row.dataType === 'boolean') return row.booleanValue === true ? 'Yes' : row.booleanValue === false ? 'No' : ''
  const value = row.dataType === 'date'
    ? normalizeDate(row.rawValue ?? row.inputValue ?? row.value)
    : row.rawValue ?? row.inputValue ?? row.value
  return value == null ? '' : String(value)
}

export function normalizeRentalMarketplaceAttributes(rows: any[]) {
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const definition = definitions.get(String(row.attributeDefinitionId || ''))
    const dataType = definition?.dataType || row.dataType
    const value = dataType === 'single_option'
      ? (Array.isArray(row.optionValues) ? row.optionValues[0] : row.optionValues)
      : dataType === 'multiple_option'
        ? (Array.isArray(row.optionValues) ? row.optionValues : [])
        : dataType === 'boolean'
          ? row.booleanValue
          : dataType === 'date'
            ? normalizeDate(row.rawValue ?? row.inputValue ?? row.value)
            : row.rawValue ?? row.inputValue ?? row.value
    return {
      ...row,
      dataType,
      colorValue: dataType === 'color' ? value : undefined,
      value,
      valueLabel: valueLabel({ ...row, dataType, value }),
      unitId: dataType === 'measurement' ? row.unitId : undefined,
    }
  })
}

export function hydrateRentalMarketplaceAttributes(rows: any[]) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    rawValue: ['single_option', 'multiple_option', 'boolean'].includes(row.dataType) ? undefined : row.inputValue,
    colorValue: row.dataType === 'color' ? row.inputValue : undefined,
    optionValues: row.dataType === 'single_option'
      ? (row.inputValue ? [row.inputValue] : [])
      : row.dataType === 'multiple_option' ? row.inputValue || [] : [],
    booleanValue: row.dataType === 'boolean' ? row.inputValue : undefined,
    value: row.inputValue,
  }))
}

function setValueFieldVisibility(field: Field, dataType: string, prefix: string) {
  const update = (name: string, visible: boolean, extra: Record<string, unknown> = {}) => {
    const target = field.$refs[`${prefix}${name}`]
    if (target) target.setParams({ ...target.$params, invisible: !visible, ...extra })
  }
  update('RawValue', ['text', 'integer', 'decimal', 'date', 'measurement', 'color'].includes(dataType), {
    type: dataType === 'integer' ? 'integer' : ['decimal', 'measurement'].includes(dataType) ? 'float' : dataType === 'date' ? 'date' : 'text',
  })
  update('ColorValue', dataType === 'color')
  update('OptionValues', ['single_option', 'multiple_option'].includes(dataType), { multiple: dataType === 'multiple_option' })
  update('BooleanValue', dataType === 'boolean')
  update('Unit', dataType === 'measurement')
}

function resetValueFieldsForDefinition(field: Field, prefix: string) {
  field.$master?.$set('rawValue', undefined)
  field.$master?.$set('colorValue', undefined)
  field.$master?.$set('optionValues', [])
  field.$master?.$set('booleanValue', undefined)
  field.$master?.$set('unitId', undefined)
  field.$master?.$set('value', undefined)
  field.$master?.$set('valueLabel', '')

  field.$refs[`${prefix}OptionValues`]?.loadOptions?.()
  field.$refs[`${prefix}Unit`]?.loadOptions?.()
}

async function fetchDefinitions(rentalProviderId: string, facetId: string, variantDefining: boolean) {
  if (!facetId) return []
  const response = await Api.instance
    .service(`rental-providers/${rentalProviderId}/marketplace-categories/${facetId}/attributes`)
    .find({ query: { $paginate: false } }) as any
  const rows = (Array.isArray(response) ? response : response?.data || []) as RentalMarketplaceAttributeDefinition[]
  rows.forEach((row) => definitions.set(row.id, row))
  return rows.filter((row) => Boolean(row.isVariantDefining) === variantDefining)
}

async function unitOptions(definitionId: string) {
  const definition = definitions.get(definitionId)
  if (!definition?.unitGroup) return []
  const response = await Api.instance.service('reference-data/units').find({ query: { $paginate: false } }) as any
  const rows = Array.isArray(response) ? response : response?.data || []
  return rows
    .filter((row: any) => row.unitGroup === definition.unitGroup)
    .map((row: any) => ({ id: row.id, name: `${row.name} (${row.symbol})` }))
}

export function rentalMarketplaceAttributesField(options: {
  rentalProviderId: () => string
  facetId: () => string | undefined | Promise<string | undefined>
  variantDefining?: boolean
}) {
  const variantDefining = Boolean(options.variantDefining)
  const prefix = variantDefining ? 'rentalVariantMarketplace' : 'rentalMarketplace'
  return $FD({
    label: variantDefining ? 'Marketplace Variant Attributes' : 'Marketplace Category Attributes',
    storage: 'marketplaceAttributes',
    type: 'collection',
    cols: 12,
    hint: variantDefining
      ? 'Variant-defining attributes come from the item category. Additional variant attributes remain available below.'
      : 'Structured attributes come from the selected global Rental category. Additional free-entry attributes remain available below.',
  }, {
    headers: () => [
      { title: 'Attribute', value: 'label' },
      { title: 'Value', value: 'valueLabel' },
      { title: 'Origin', value: 'categoryLabel' },
    ],
    form: () => $FM({}, {
      saved(form) {
        const master = form.$master
        master?.$set('valueLabel', valueLabel({
          attributeDefinitionId: master?.$get('attributeDefinitionId'),
          dataType: master?.$get('dataType'),
          optionValues: master?.$get('optionValues'),
          booleanValue: master?.$get('booleanValue'),
          rawValue: master?.$get('rawValue'),
        }))
      },
      children: () => [$PT({}, {
        children: () => [
          $FD({ label: 'Attribute', storage: 'attributeDefinitionId', type: 'select', required: true }, {
            selectOptions: async () => {
              const facetId = await options.facetId()
              if (!facetId) return []
              return (await fetchDefinitions(options.rentalProviderId(), facetId, variantDefining)).map((definition) => ({
                id: definition.id,
                name: `${definition.label}${definition.isRequired ? ' *' : ''} (${definition.categoryLabel})`,
              }))
            },
            changed(field) {
              const definitionId = String(field.$value || '')
              const definition = definitions.get(definitionId)
              if (!definition) return
              const previousDefinitionId = selectedDefinitionByField.get(field)
              selectedDefinitionByField.set(field, definitionId)
              field.$master?.$set('label', definition.label)
              field.$master?.$set('categoryLabel', definition.categoryLabel)
              field.$master?.$set('dataType', definition.dataType)
              field.$master?.$set('attributeDescription', definition.description || 'No additional guidance.')
              setValueFieldVisibility(field, definition.dataType, prefix)
              if (previousDefinitionId && previousDefinitionId !== definitionId) {
                resetValueFieldsForDefinition(field, prefix)
              } else {
                field.$refs[`${prefix}OptionValues`]?.loadOptions?.()
                field.$refs[`${prefix}Unit`]?.loadOptions?.()
              }
            },
            setup(field) {
              Promise.resolve().then(() => {
                const definitionId = String(field.$value || '')
                const definition = definitions.get(definitionId)
                if (definition) {
                  selectedDefinitionByField.set(field, definitionId)
                  setValueFieldVisibility(field, definition.dataType, prefix)
                }
              })
            },
          }),
          $FD({ label: 'Guidance', storage: 'attributeDescription', type: 'textarea', readonly: true }),
          $FD({ ref: `${prefix}RawValue`, label: 'Value', storage: 'rawValue', hint: 'For colors, pick a swatch or enter a hexadecimal value such as #1A73E8.' }),
          $FD({ ref: `${prefix}ColorValue`, label: 'Color Picker', storage: 'colorValue', type: 'color', invisible: true }, {
            changed(field) {
              if (field.$value) field.$master?.$set('rawValue', field.$value)
            },
          }),
          $FD({ ref: `${prefix}OptionValues`, label: 'Option Value', storage: 'optionValues', type: 'select', multiple: true, invisible: true }, {
            selectOptions: async (field) => {
              const definition = definitions.get(String(field.$master?.$get('attributeDefinitionId') || ''))
              return (definition?.options || []).map((option) => ({ id: option.code, name: option.label }))
            },
          }),
          $FD({ ref: `${prefix}BooleanValue`, label: 'Yes / No', storage: 'booleanValue', type: 'select', clearable: true, invisible: true }, {
            selectOptions: async () => [{ id: true, name: 'Yes' }, { id: false, name: 'No' }],
          }),
          $FD({ ref: `${prefix}Unit`, label: 'Unit', storage: 'unitId', type: 'select', clearable: true, invisible: true }, {
            selectOptions: async (field) => unitOptions(String(field.$master?.$get('attributeDefinitionId') || '')),
          }),
        ],
      })],
    }),
  })
}
