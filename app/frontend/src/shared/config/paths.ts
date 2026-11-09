export const paths = {
  home: '/',
  map: '/mapa',
  admin: '/admin',
  adminMap: '/admin/mapa',
  adminArchive: '/admin/acervo',
  login: '/login',
  about: '/sobre',
  lab: '/laboratorio',
} as const

export type AppPath = (typeof paths)[keyof typeof paths]
