export const paths = {
  home: '/',
  map: '/mapa',
  admin: '/admin',
  adminMap: '/admin/mapa',
  adminArchive: '/admin/acervo',
  login: '/login',
  lab: '/laboratorio',
} as const

export type AppPath = (typeof paths)[keyof typeof paths]
