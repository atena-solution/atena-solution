// Service worker dos avisos do Atendimento (web push).
self.addEventListener('push', (evento) => {
  let dados = { titulo: 'Atena', corpo: 'Cliente esperando no WhatsApp', url: '/atendimento' }
  try {
    dados = { ...dados, ...evento.data.json() }
  } catch (_) {}
  evento.waitUntil(
    self.registration.showNotification(dados.titulo, { body: dados.corpo, data: { url: dados.url }, tag: dados.url, renotify: true }),
  )
})

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const url = (evento.notification.data && evento.notification.data.url) || '/atendimento'
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const j of janelas) if ('focus' in j) return j.navigate(url).then((w) => w && w.focus())
      return self.clients.openWindow(url)
    }),
  )
})
