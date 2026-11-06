export const paths = {
  home: '/',
  map: '/mapa',
  admin: '/admin',
  login: '/login',
  lab: '/laboratorio',
} as const

export type AppPath = (typeof paths)[keyof typeof paths]
