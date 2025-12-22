# 🚀 Integración **paso a paso en Vue 3**

Vamos a integrarlo **bien**, respetando lifecycle y sin memory leaks.

---

## 🧩 Opción recomendada en Vue 3

👉 **Cargar el widget como script externo**, no importarlo.

Esto evita:

* problemas de bundler
* SSR issues
* dependencias innecesarias

---

## 🧱 PASO 1 — Incluir el widget (main.html o index.html)

En `public/index.html` o `index.html`:

```html
<link
  rel="stylesheet"
  href="https://github.com/luis-byt/chat-widget/releases/download/v1.0.1/chat-widget.css"
/>

<script
  src="https://github.com/luis-byt/chat-widget/releases/download/v1.0.1/chat-widget.js"
  defer
></script>
```

---

## 🧱 PASO 2 — Crear componente Vue

### `components/ChatWidget.vue`

```vue
<template>
  <!-- El widget se monta solo, no necesita HTML -->
  <div></div>
</template>

<script setup>
import { onMounted, onBeforeUnmount } from "vue"

let chatInstance = null

onMounted(() => {
  if (!window.ChatWidget) {
    console.error("ChatWidget no cargado")
    return
  }

  chatInstance = new window.ChatWidget({
    token: localStorage.getItem("access_token"),
    currentUserId: Number(localStorage.getItem("user_id")),
    isDoctor: false,

    apiBaseUrl: import.meta.env.VITE_API_URL,
    wsBaseUrl: import.meta.env.VITE_WS_URL,

    logo: "PON_AKI_CLASS_LOGO", //Ejemplo: "fa-solid fa-comment-dots" esta clase se colocaria en un <i class="fa-solid fa-comment-dots"></i> asi
    primaryColor: "#080859",

    endpoints: {
      inbox: "/inbox/",
      contacts: "/contacts/",
      createConversation: "/conversations/",
      messages: (id) => `/conversations/${id}/messages/`,
      uploadAttachment: (id) => `/messages/${id}/attachments/`
    }
  })

  chatInstance.mount()
})

onBeforeUnmount(() => {
  if (chatInstance && chatInstance._resetWidget) {
    chatInstance._resetWidget()
    chatInstance = null
  }
})
</script>
```

---

## 🧱 PASO 3 — Variables de entorno (Vue)

En `.env`:

```env
VITE_API_URL=https://expedientes.aware.mx/chat/v1
VITE_WS_URL=wss://expedientes.aware.mx
```

---

## 🧪 PASO 4 — Usarlo en una vista

```vue
<template>
  <ChatWidget />
</template>

<script setup>
import ChatWidget from "@/components/ChatWidget.vue"
</script>
```

---

## 🧠 Buenas prácticas (IMPORTANTE)

✔ No importes el JS como módulo
✔ No lo metas en `setup()` directamente
✔ Siempre limpiar en `onBeforeUnmount`
✔ Token siempre dinámico

---

## ✅ Resultado final

* Widget aparece flotante
* WebSocket funciona
* Inbox, badges, typing, adjuntos OK
* Sin memory leaks
* Vue feliz 😄
