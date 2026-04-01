import { createRouter, createWebHistory } from 'vue-router'
import ChatView          from '../views/ChatView.vue'
import DashboardView     from '../views/DashboardView.vue'
import AuthRegisterView  from '../views/AuthRegisterView.vue'
import AuthLoginView     from '../views/AuthLoginView.vue'

const routes = [
  { path: '/',                redirect: '/auth/register' },
  { path: '/auth/register',  name: 'AuthRegister', component: AuthRegisterView },
  { path: '/auth/login',     name: 'AuthLogin',    component: AuthLoginView },
  { path: '/chat',           name: 'Chat',         component: ChatView,        meta: { requiresAuth: true } },
  { path: '/chat/:id',       name: 'ChatSession',  component: ChatView,        meta: { requiresAuth: true } },
  { path: '/dashboard',      name: 'Dashboard',    component: DashboardView,   meta: { requiresAuth: true } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  const loggedIn = !!localStorage.getItem('consilium_token')
  // Redirect authenticated users away from auth pages
  if (to.path.startsWith('/auth') && loggedIn) return '/chat'
  // Redirect unauthenticated users away from protected pages
  if (to.meta.requiresAuth && !loggedIn) return '/auth/login'
})

export default router
