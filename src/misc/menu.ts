import { $MI, $MN, Menu, MenuItemOptions } from 'vuetify-extended'

export interface MakeCollectionMenuOptions {
  collection: MenuItemOptions['collection']
  title: string
  allowCreate?: boolean
  allowEdit?: boolean
  allowDisplay?: boolean
  access?: MenuItemOptions['access']
  accessCreate?: MenuItemOptions['access']
  accessEdit?: MenuItemOptions['access']
  accessDisplay?: MenuItemOptions['access']
}

export function makeCollectionMenu(options: MakeCollectionMenuOptions): Menu {
  const allowCreate = options.allowCreate ?? true
  const allowEdit = options.allowEdit ?? true
  const allowDisplay = options.allowDisplay ?? true

  const mn = $MN(
    {
      title: options.title,
      cols: 12,
      width: 240,
    },
    {
      children: async () => [
        ...(allowCreate
          ? [
              $MI(
                {
                  text: 'Create',
                  icon: 'mdi-plus',
                  shortcut: 'C',
                  action: 'collection',
                  mode: 'create',
                  color: 'success',
                },
                {
                  collection: options.collection,
                  access: options.accessCreate ?? options.access,
                },
              ),
            ]
          : []),
        ...(allowEdit
          ? [
              $MI(
                {
                  text: 'Edit',
                  icon: 'mdi-pencil',
                  shortcut: 'E',
                  action: 'collection',
                  mode: 'edit',
                  color: 'warning',
                },
                {
                  collection: options.collection,
                  access: options.accessEdit ?? options.access,
                },
              ),
            ]
          : []),
        ...(allowDisplay
          ? [
              $MI(
                {
                  text: 'Display',
                  icon: 'mdi-eye',
                  shortcut: 'D',
                  action: 'collection',
                  mode: 'display',
                  color: 'info',
                },
                {
                  collection: options.collection,
                  access: options.accessDisplay ?? options.access,
                },
              ),
            ]
          : []),
      ],
    },
  )
  return mn
}
