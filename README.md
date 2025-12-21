# Aware Chat Widget

**Aware Chat Widget** es un widget de chat embebible, en tiempo real, diseñado para integrarse fácilmente en aplicaciones **Django**, **Vue** y **HTML puro**.

Está construido con:
- WebSockets (tiempo real)
- API REST
- JWT Authentication
- UMD (Universal Module Definition)

👉 No depende de npm para funcionar en producción.

---

## ✨ Características

- 💬 Chat en tiempo real (WebSocket)
- 🔔 Badge de mensajes no leídos (por conversación y global)
- ✍️ Indicador “escribiendo…”
- 🟢 Presencia online / offline
- ✓✓ Confirmación de lectura
- 📎 Adjuntos (imágenes y PDF)
- 🖼 Preview de adjuntos antes de enviar
- 🔍 Búsqueda en inbox
- 🎨 Color primario configurable
- 👨‍⚕️ Roles (doctor / paciente)
- 📦 Embebible en cualquier sitio web

---

## 📦 Distribución

El widget se distribuye como archivo **UMD**, por lo que puede usarse con:

- `<script>` en HTML
- Django Templates
- Vue / React / cualquier framework

Archivos necesarios:
- `aware-chat-widget.umd.js`
- `aware-chat-widget.css`

---

## 🚀 Uso rápido (HTML / Django)

### 1️⃣ Incluir los archivos

```html
<link rel="stylesheet" href="/static/chat-widget/aware-chat-widget.css">

<script src="/static/chat-widget/aware-chat-widget.umd.js"></script>
```
```js
<script>
  const chat = new ChatWidget({
    logo: "flaticon2-telegram-logo",
    primaryColor: "#080859",

    apiBaseUrl: "https://tu-backend.com/chat/v1",
    wsBaseUrl: "wss://tu-backend.com",

    token: "JWT_DEL_USUARIO",
    currentUserId: 1,
    isDoctor: false,

    endpoints: {
      inbox: "/inbox/",
      contacts: "/contacts/",
      createConversation: "/conversations/",
      messages: function (conversationId) {
        return "/conversations/" + conversationId + "/messages/"
      },
      uploadAttachment: function (messageId) {
        return "/messages/" + messageId + "/attachments/"
      }
    }
  })

  chat.mount()
</script>
```
---
| Opción          | Tipo      | Descripción                      |
| --------------- | --------- | -------------------------------- |
| `token`         | `string`  | JWT del usuario autenticado      |
| `currentUserId` | `number`  | ID del usuario actual            |
| `isDoctor`      | `boolean` | Define si el usuario es médico   |
| `apiBaseUrl`    | `string`  | URL base de la API REST          |
| `wsBaseUrl`     | `string`  | URL base del WebSocket           |
| `primaryColor`  | `string`  | Color principal del widget       |
| `logo`          | `string`  | Clase CSS del icono del launcher |
| `endpoints`     | `object`  | Rutas del backend                |


- GET    /inbox/
- GET    /contacts/
- POST   /conversations/
- GET    /conversations/{id}/messages/
- POST   /messages/{id}/attachments/

