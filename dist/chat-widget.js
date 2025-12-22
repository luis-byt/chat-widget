/*!
 * LuisByt Chat Widget v1.0.2
 * https://github.com/luis-byt/chat-widget
 * © 2025 Byt
 * MIT License
 */
var ChatWidget = (function () {
  'use strict';

  function ApiClient(options) {
      this.baseUrl = options.apiBaseUrl;
      this.token = options.token;
      this.endpoints = options.endpoints || {};
    }

    ApiClient.prototype.request = function (url, method, body) {
      return fetch(this.baseUrl + url, {
        method: method || "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "JWT " + this.token
        },
        body: body ? JSON.stringify(body) : null
      }).then(function (res) {
        if (!res.ok) throw new Error("API error")
        return res.json()
      })
    };

    ApiClient.prototype.getInbox = function () {
      return this.request(this.endpoints.inbox)
    };

    ApiClient.prototype.getContacts = function () {
      return this.request(this.endpoints.contacts)
    };

    ApiClient.prototype.createConversation = function (contactId, contactRole) {
      return this.request(
        this.endpoints.createConversation,
        "POST",
        {
          contact_id: contactId,
          contact_role: contactRole
        }
      )
    };

    ApiClient.prototype.getMessages = function (conversationId) {
      return this.request(
        this.endpoints.messages(conversationId)
      )
    };

    ApiClient.prototype.uploadAttachment = function (messageId, file) {
      var form = new FormData();
      form.append("file", file);

      return fetch(
        this.baseUrl + this.endpoints.uploadAttachment(messageId),
        {
          method: "POST",
          headers: {
            Authorization: "JWT " + this.token
          },
          body: form
        }
      ).then(function (res) {
        if (!res.ok) throw new Error("Upload failed")
        return res.json()
      })
    };

    function WebSocketClient(options) {
      this.wsBaseUrl = options.wsBaseUrl;
      this.token = options.token;
      this.socket = null;
    }

    WebSocketClient.prototype.connect = function (conversationId, handlers) {
      var url =
        this.wsBaseUrl +
        "/ws/chat/" +
        conversationId +
        "/?token=" +
        this.token;

      this.socket = new WebSocket(url);

      this.socket.onopen = function () {
        handlers.onOpen && handlers.onOpen();
      };

      this.socket.onmessage = function (event) {
        var data = JSON.parse(event.data);
        handlers.onMessage && handlers.onMessage(data);
      };

      this.socket.onclose = function () {
        handlers.onClose && handlers.onClose();
      };

      this.socket.onerror = function (err) {
        console.error("WS error", err);
      };
    };

    WebSocketClient.prototype.send = function (payload) {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify(payload));
      }
    };

    WebSocketClient.prototype.disconnect = function () {
      if (this.socket) {
        this.socket.close();
        this.socket = null;
      }
    };

    function formatDate(isoString) {
     var d = new Date(isoString);
     return d.toLocaleDateString() + " " + d.toLocaleTimeString([], {
       hour: "2-digit",
       minute: "2-digit"
     })
   }

    function formatInboxDate(isoString) {
      if (!isoString) return ""

      var date = new Date(isoString);
      var now = new Date();

      // Normalizar a medianoche
      var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      var messageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

      var diffDays = Math.floor(
        (today - messageDay) / (1000 * 60 * 60 * 24)
      );

      // Hoy → hora
      if (diffDays === 0) {
        return date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit"
        })
      }

      // Ayer
      if (diffDays === 1) {
        return "Ayer"
      }

      // Días anteriores → fecha
      return date.toLocaleDateString()
    }

    function formatLastMessagePreview(lastMessage) {
      if (!lastMessage) return "Sin mensajes"
    
      // 📎 Si hay adjuntos
      if (lastMessage.attachments && lastMessage.attachments.length > 0) {
        const count = lastMessage.attachments.length;
        return count === 1 ? "1 Adjunto" : `${count} Adjuntos`
      }
    
      // 💬 Texto normal (una sola línea)
      if (lastMessage.text) {
        const text = lastMessage.text.trim();
        return text.length > 40 ? text.slice(0, 40) + "…" : text
      }
    
      return "Mensaje"
    }
    

    function ChatWidget(options) {
      this.options = options || {};
      this.api = new ApiClient(options);
      this.ws = new WebSocketClient(options);

      this.state = {
        isOpen: false,
        view: "inbox",

        inbox: {
          loading: false,
          conversations: []
        },

        contacts: {
          loading: false,
          list: []
        },

        conversation: {
          id: null,
          receiver: null,
          messages: [],
          loading: false
        }
      };

      this.launcher = null;
      this.container = null;
      this.pendingAttachments = [];
      this.pendingText = "";
      this.pendingMessageId = null;
      this.isSending = false;
      this.totalUnread = 0;

    }

    /* =========================
       PUBLIC API
    ========================= */

    ChatWidget.prototype.mount = function () {
      this._createLauncher();
      this._createWidget();
      this._render();
    };

    /* =========================
       CORE UI
    ========================= */

    ChatWidget.prototype._createLauncher = function () {
      var btn = document.createElement("div");
      btn.className = "aware-chat-launcher";
      btn.innerHTML = `
      <i class="${this.options.logo}"></i>
      <span class="launcher-badge hidden" id="launcher-badge"></span>
    `;

      // 🎨 Color primario configurable
      var primary = this.options.primaryColor || "#0d6efd";
      btn.style.setProperty("--aware-primary", primary);

      btn.onclick = this.toggle.bind(this);

      document.body.appendChild(btn);
      this.launcher = btn;
    };

    ChatWidget.prototype._createWidget = function () {
      var el = document.createElement("div");
      el.className = "aware-chat-widget hidden";

      // 🎨 Color primario configurable
      var primary = this.options.primaryColor || "#0d6efd";
      el.style.setProperty("--aware-primary", primary);

      document.body.appendChild(el);
      this.container = el;
    };

    ChatWidget.prototype.toggle = function () {
      this.state.isOpen = !this.state.isOpen;

      if (!this.state.isOpen) {
        // 🔴 CERRANDO WIDGET
        this.container.classList.add("hidden");

        // Reset completo (cierra WS, limpia estado y vuelve a inbox)
        this._resetWidget();
        return
      }

      // 🟢 ABRIENDO WIDGET
      this.container.classList.remove("hidden");

      // Siempre renderizar inbox al abrir
      this.state.view = "inbox";
      this._render();
    };

    ChatWidget.prototype.navigate = function (view, conversationId, receiver) {
      this.state.view = view;
      this.state.conversation.id = conversationId || null;
      this.state.conversation.receiver = receiver || null;

      // 🔔 LIMPIAR BADGE AL ENTRAR A CONVERSACIÓN
      if (view === "conversation" && conversationId) {
        var conv = this.state.inbox.conversations.find(
          c => c.id === conversationId
        );

        if (conv && conv.unread_count) {
          this.totalUnread -= conv.unread_count;
          conv.unread_count = 0;
          this._renderLauncherBadge();
        }

        this._clearInboxBadge(conversationId);
      }

      this._render();
    };

    /* =========================
       RENDER
    ========================= */

    ChatWidget.prototype._render = function () {
      if (!this.container) return

      this.container.innerHTML = "";

      if (this.state.view === "inbox") {
        this._renderInbox();
      }

      if (this.state.view === "new") {
        this._renderNewConversation();
      }

      if (this.state.view === "conversation") {
        this._renderConversation();
      }
    };

    /* =========================
       VIEWS
    ========================= */

    ChatWidget.prototype._renderInbox = function () {
     var self = this;
     var body = document.createElement("div");
     body.className = "aware-chat-body";
     body.innerHTML = "Cargando conversaciones...";

     this.container.innerHTML = `
     <div class="aware-chat-header">
        <div class="aware-chat-header-top">
          <strong>Mensajes</strong>
          <button class="aware-btn" id="new-chat">＋</button>
        </div>


     </div>
   `;
      /*<div class="aware-chat-search">
        <input
          type="text"
          id="inbox-search"
          placeholder="Buscar conversaciones…"
        />
      </div>*/
     this.container.appendChild(body);

     this.api.getInbox().then(function (conversations) {
       self.state.inbox.conversations = conversations;

       self._renderInboxList(conversations);
       // 🔔 Calcular total de no leídos
       self._updateTotalUnread(conversations);

       body.innerHTML = "";

       if (!conversations.length) {
         body.innerHTML = "<p>No hay conversaciones</p>";
         return
       }

       conversations.forEach(function (conv) {
         // 👉 determinar el otro usuario
         var otherUserLabel = "";
         if (conv.doctor.id === self.options.currentUserId) {
           otherUserLabel = conv.patient.full_name;
         } else {
           otherUserLabel = conv.doctor.full_name;
         }

         var unread = conv.unread_count || 0;

         var lastMessageText = formatLastMessagePreview(conv.last_message);

         var item = document.createElement("div");
         item.className = "aware-chat-item" + (unread > 0 ? " unread" : "");

         var lastDate = conv.last_message
           ? formatInboxDate(conv.last_message.created_at)
           : "";

         item.innerHTML = `
        <div class="aware-chat-item-row">
          <strong>${otherUserLabel}</strong>
          <div class="inbox-meta">
            <span class="inbox-date">${lastDate}</span>
            ${
              unread > 0
                ? `<span class="inbox-badge">${unread}</span>`
                : ""
            }
          </div>
        </div>
        <div class="last-message">${lastMessageText}</div>
      `;

         item.onclick = function () {
           self.navigate("conversation", conv.id, otherUserLabel);
         };

         body.appendChild(item);
       });
     }).catch(function (err) {
       body.innerHTML = "<p>Error cargando inbox</p>";
       console.error(err);
     });

     this.container.querySelector("#new-chat").onclick = function () {
       self.navigate("new");
     };

  //   var searchInput = this.container.querySelector("#inbox-search")

  //   searchInput.oninput = function () {
  //     var query = searchInput.value.toLowerCase().trim()
  //
  //     var filtered = self.state.inbox.conversations.filter(function (conv) {
  //       var name =
  //         conv.doctor.id === self.options.currentUserId
  //           ? conv.patient.full_name
  //           : conv.doctor.full_name
  //
  //       var lastText = conv.last_message
  //         ? conv.last_message.text
  //         : ""
  //
  //       return (
  //         name.toLowerCase().includes(query) ||
  //         lastText.toLowerCase().includes(query)
  //       )
  //     })
  //
  //     self._renderInboxList(filtered)
  //   }

   };

    ChatWidget.prototype._renderInboxList = function (conversations) {
      var body = this.container.querySelector(".aware-chat-body");
      if (!body) return

      body.innerHTML = "";

      if (!conversations.length) {
        body.innerHTML = "<p>No hay resultados</p>";
        return
      }

      var self = this;

      conversations.forEach(function (conv) {
        var otherUserLabel = "";
        if (conv.doctor.id === self.options.currentUserId) {
          otherUserLabel = conv.patient.full_name;
        } else {
          otherUserLabel = conv.doctor.full_name;
        }

        var lastMessageText = formatLastMessagePreview(conv.last_message);

        var lastDate = conv.last_message
          ? formatInboxDate(conv.last_message.created_at)
          : "";

        var unread = conv.unread_count || 0;

        var item = document.createElement("div");
        item.className = "aware-chat-item" + (unread > 0 ? " unread" : "");
        
        item.setAttribute("data-conversation-id", conv.id);

        item.innerHTML = `
        <div class="aware-chat-item-row">
          <strong>${otherUserLabel}</strong>
          <div class="inbox-meta">
            <span class="inbox-date">${lastDate}</span>
            ${unread > 0 ? `<span class="inbox-badge">${unread}</span>` : ""}
          </div>
        </div>
        <div class="last-message">${lastMessageText}</div>
      `;

        item.onclick = function () {
          self.navigate("conversation", conv.id, otherUserLabel);
        };

        body.appendChild(item);
      });
    };

    ChatWidget.prototype._renderNewConversation = function () {
      var self = this;

      this.container.innerHTML = `
      <div class="aware-chat-header">
        <button class="aware-btn" id="back">←</button>
        <strong>Nueva conversación</strong>
      </div>

      <div class="aware-chat-body" id="contacts-body">
        Cargando contactos...
      </div>
    `;

      var body = this.container.querySelector("#contacts-body");

      this.api.getContacts()
        .then(function (contacts) {
          body.innerHTML = "";

          if (!contacts.length) {
            body.innerHTML = "<p>No hay contactos disponibles</p>";
            return
          }

          contacts.forEach(function (contact) {
            var item = document.createElement("div");
            item.className = "aware-chat-item";

            item.innerHTML = `
            <strong>${contact.name}</strong>
            <div class="last-message">
              ${contact.role === "doctor" ? "Doctor" : "Paciente"}
            </div>
          `;
            item.onclick = function () {
              self.api.createConversation(contact.id, contact.role)
                .then(function (conv) {
                  self.navigate("conversation", conv.id);
                })
                .catch(function (err) {
                  console.error("Error creando conversación", err);
                });
            };

            body.appendChild(item);
          });
        })
        .catch(function (err) {
          body.innerHTML = "<p>Error cargando contactos</p>";
          console.error(err);
        });

      this.container.querySelector("#back").onclick = function () {
        self.navigate("inbox");
      };
    };

    ChatWidget.prototype._renderConversation = function () {
        var self = this;

        this.container.innerHTML = `
        <div class="aware-chat-header">
          <div class="aware-chat-header-top">
            <button class="aware-btn" id="back">←</button>
            <strong>${this.state.conversation.receiver}</strong>
            <div class="aware-chat-header-status">
              <span
                class="presence-dot offline"
                id="presence-dot"
              ></span>
              <span id="presence-text">Desconectado</span>
            </div>
          </div>

          <div
            class="aware-chat-header-typing"
            id="typing-indicator"
            style="display:none;"
          >
            Escribiendo…
          </div>
        </div>

        <div class="aware-chat-body" id="chat-body">
          Cargando mensajes...
        </div>

        <div
          class="aware-attachments-preview"
          id="attachments-preview"
        ></div>

        <div class="aware-chat-input">
          <input
            type="text"
            id="chat-input"
            placeholder="Escribe un mensaje…"
          />
          <button class="aware-attach-btn" id="attach-btn">📎</button>
          <input type="file" id="file-input" multiple style="display:none;" />
          <button class="aware-send-btn" id="send-btn" title="Enviar">
            ➤
          </button>
        </div>
      `;

        var body = this.container.querySelector("#chat-body");
        var attachBtn = this.container.querySelector("#attach-btn");
        var fileInput = this.container.querySelector("#file-input");
        var input = this.container.querySelector("#chat-input");
        var sendBtn = this.container.querySelector("#send-btn");

        attachBtn.onclick = function () {
          fileInput.click();
        };

        fileInput.onchange = function () {
          var files = Array.from(fileInput.files);

          files.forEach(function (file) {
            self.pendingAttachments.push(file);
          });

          self._renderAttachmentPreviews();

          // 👇 MUY IMPORTANTE
          fileInput.value = "";
        };

        /* =========================
           Cargar mensajes (REST)
        ========================= */

        this.api.getMessages(this.state.conversation.id)
          .then(function (data) {
            body.innerHTML = "";

            var messages = Object.values(data);

            if (!messages.length) {
              body.innerHTML = "<p>No hay mensajes</p>";
              return
            }

            messages.forEach(function (msg) {
              self._appendMessage(msg);
            });

            body.scrollTop = body.scrollHeight;
          })
          .catch(function (err) {
            body.innerHTML = "<p>Error cargando mensajes</p>";
            console.error(err);
          });

        function sendMessage() {
          self.ws.send({ type: "typing", is_typing: false });

          if (self.isSending) return

          var text = input.value.trim();

          // ❌ No permitir enviar si no hay nada
          if (!text && self.pendingAttachments.length === 0) {
            return
          }

          self.isSending = true;
          self.pendingText = text;

          self.ws.send({
            type: "message",
            text: text
          });

          input.value = "";
        }

        sendBtn.onclick = sendMessage;
        input.onkeydown = function (e) {
          if (e.key === "Enter") {
            sendMessage();
          }
        };

        var typingTimeout = null;

        input.oninput = function () {
          self.ws.send({ type: "typing", is_typing: true });

          clearTimeout(typingTimeout);
          typingTimeout = setTimeout(function () {
            self.ws.send({ type: "typing", is_typing: false });
          }, 1000);
        };

        /* =========================
           Back
        ========================= */

        this.container.querySelector("#back").onclick = function () {
          self.ws.disconnect();
          self.navigate("inbox");
        };

        self.ws.disconnect();

        self.ws.connect(this.state.conversation.id, {
          onOpen: function () {
            self.ws.send({ type: "read" });
          },

          onMessage: function (data) {
            self._handleWsEvent(data);
          }
        });

      };

    ChatWidget.prototype._handleWsEvent = function (data) {
      if (data.type === "message") {

        if (
          this.state.view !== "conversation" &&
          data.message.sender !== this.options.currentUserId
        ) {
          this.totalUnread += 1;
          this._renderLauncherBadge();
        }

        // 📨 SI NO ESTOY EN LA CONVERSACIÓN → incrementar badge
        if (this.state.view !== "conversation") {
          this._incrementInboxBadge(data.message.conversation_id);
        }

        // 📩 SI ESTOY EN LA CONVERSACIÓN → manejar mensaje normal
        if (this.state.view === "conversation") {
          this._handleOwnMessageCreated(data.message);
        }

        return
      }

      if (data.type === "typing") {
        this._handleTyping(data);
      }

      if (data.type === "presence") {
        this._handlePresence(data);
      }

      if (data.type === "read") {
        this._handleReadReceipt(data);
      }

      if (data.type === "attachment") {
        this._appendAttachment(data.message_id, data.attachment);
      }
    };

    ChatWidget.prototype._handleOwnMessageCreated = function (msg) {
      // Dibujar mensaje inmediatamente
      this._appendMessage(msg);

      // Si NO hay adjuntos pendientes → terminar
      if (!this.pendingAttachments.length) {
        this._resetPendingState();
        return
      }

      // Guardar ID del mensaje
      var messageId = msg.id;
      var self = this;

      // 2️⃣ Subir adjuntos uno por uno
      var uploads = this.pendingAttachments.map(function (file) {
        return self.api.uploadAttachment(messageId, file)
      });

      Promise.all(uploads)
        .then(function () {
          // Los adjuntos llegarán por WS
          self._resetPendingState();
        })
        .catch(function (err) {
          console.error("Error subiendo adjuntos", err);
          self._resetPendingState();
        });
    };

    ChatWidget.prototype._appendMessage = function (msg) {
      var body = this.container.querySelector("#chat-body");
      if (!body) return

      var hasOnlyImage =
      msg.attachments &&
      msg.attachments.length === 1 &&
      msg.attachments[0].file_type.startsWith("image") &&
      !msg.text;


      var isMine = msg.sender === this.options.currentUserId;

      var div = document.createElement("div");
      div.className =
        "aware-message " + (isMine ? "mine" : "other") + (hasOnlyImage ? " image-only" : "");

      div.setAttribute("data-message-id", msg.id);

      var html = `
      <div class="message-text">${msg.text || ""}</div>
      <div class="message-meta">
        <span class="message-date">${formatDate(msg.created_at)}</span>
        ${isMine ? '<span class="message-status">✓</span>' : ""}
      </div>
    `;

      // 👇 AGREGAR ADJUNTOS SI EXISTEN
      if (msg.attachments && msg.attachments.length) {
        msg.attachments.forEach(function (att) {
          if (att.file_type.startsWith("image")) {
            html += `
            <img src="${att.file}" class="chat-image" />
          `;
          } else {
            var fileName = att.file.split("/").pop();

            html += `
            <div class="chat-attachment chat-attachment-pdf">
              <div class="chat-attachment-icon">📄</div>
              <div class="chat-attachment-info">
                <div class="chat-attachment-name">${fileName}</div>
                <div class="chat-attachment-meta">
                  ${(att.file_size / 1024).toFixed(0)} KB
                </div>
                <a
                  href="${att.file}"
                  target="_blank"
                  class="chat-attachment-link"
                >
                  Descargar
                </a>
              </div>
            </div>
          `;
          }
        });
      }

      div.innerHTML = html;
      body.appendChild(div);
      body.scrollTop = body.scrollHeight;
    };

    ChatWidget.prototype._appendAttachment = function (messageId, attachment) {
      var msgDiv = this.container.querySelector(
        '[data-message-id="' + messageId + '"]'
      );

      if (!msgDiv) return

      if (attachment.file_type.startsWith("image")) {
        msgDiv.innerHTML += `
        <img src="${attachment.file}" class="chat-image" />
      `;
      } else {
        var fileName = attachment.file.split("/").pop();

        msgDiv.innerHTML += `
        <div class="chat-attachment chat-attachment-pdf">
          <div class="chat-attachment-icon">📄</div>
          <div class="chat-attachment-info">
            <div class="chat-attachment-name">${fileName}</div>
            <div class="chat-attachment-meta">
              ${(attachment.file_size / 1024).toFixed(0)} KB
            </div>
            <a
              href="${attachment.file}"
              target="_blank"
              class="chat-attachment-link"
            >
              Descargar
            </a>
          </div>
        </div>
      `;
      }
    };

    ChatWidget.prototype._renderAttachmentPreviews = function () {
      var container = this.container.querySelector("#attachments-preview");
      if (!container) return

      container.innerHTML = "";

      var self = this;

      this.pendingAttachments.forEach(function (file, index) {
        var div = document.createElement("div");
        div.className = "attachment-preview";

        if (file.type.startsWith("image")) {
          var img = document.createElement("img");
          img.src = URL.createObjectURL(file);
          div.appendChild(img);
        } else {
          div.innerHTML += `
          📄 ${file.name} (${(file.size / 1024).toFixed(0)} KB)
        `;
        }

        var remove = document.createElement("span");
        remove.className = "remove";
        remove.innerText = "✖";

        remove.onclick = function () {
          self.pendingAttachments.splice(index, 1);
          self._renderAttachmentPreviews();
        };

        div.appendChild(remove);
        container.appendChild(div);
      });
    };

    ChatWidget.prototype._handleTyping = function (data) {
      // No mostrar typing propio
      console.log(this.options.isDoctor);
      if (data.sender_role === (this.options.isDoctor ? "doctor" : "patient")) {
        return
      }

      var indicator = this.container.querySelector("#typing-indicator");
      if (!indicator) return

      if (data.is_typing) {
        indicator.style.display = "block";

        indicator.innerText = "Escribiendo...";
      } else {
        indicator.style.display = "none";
      }
    };

    ChatWidget.prototype._handlePresence = function (data) {
      // Ignorar eventos propios
      if (data.user_id === this.options.currentUserId) {
        return
      }

      var dot = this.container.querySelector("#presence-dot");
      var text = this.container.querySelector("#presence-text");

      if (!dot || !text) return

      if (data.is_online) {
        dot.classList.remove("offline");
        dot.classList.add("online");
        text.innerText = "En linea";
      } else {
        dot.classList.remove("online");
        dot.classList.add("offline");
        text.innerText = "Desconectado";
      }
    };

    ChatWidget.prototype._handleReadReceipt = function (data) {
      // Solo afecta mensajes míos
      var statuses = this.container.querySelectorAll(".message-status");

      statuses.forEach(function (el) {
        el.innerText = "✓✓";
      });
    };

    ChatWidget.prototype._updateTotalUnread = function (conversations) {
      var total = 0;

      conversations.forEach(function (conv) {
        total += conv.unread_count || 0;
      });

      this.totalUnread = total;
      this._renderLauncherBadge();
    };

    ChatWidget.prototype._renderLauncherBadge = function () {
      if (!this.launcher) return

      var badge = this.launcher.querySelector("#launcher-badge");
      if (!badge) return

      if (this.totalUnread > 0) {
        badge.innerText = this.totalUnread;
        badge.classList.remove("hidden");
      } else {
        badge.classList.add("hidden");
      }
    };

    ChatWidget.prototype._incrementInboxBadge = function (conversationId) {
      var item = this.container.querySelector(
        '[data-conversation-id="' + conversationId + '"]'
      );

      if (!item) return

      var badge = item.querySelector(".inbox-badge");

      if (badge) {
        badge.innerText = parseInt(badge.innerText, 10) + 1;
      } else {
        var meta = item.querySelector(".inbox-meta");
        var span = document.createElement("span");
        span.className = "inbox-badge";
        span.innerText = "1";
        meta.appendChild(span);
      }
    };

    ChatWidget.prototype._clearInboxBadge = function (conversationId) {
      var item = this.container.querySelector(
        '[data-conversation-id="' + conversationId + '"]'
      );

      if (!item) return

      var badge = item.querySelector(".inbox-badge");
      if (badge) badge.remove();
    };

    ChatWidget.prototype._resetPendingState = function () {
      this.pendingAttachments = [];
      this.pendingText = "";
      this.pendingMessageId = null;
      this.isSending = false;

      var preview = this.container.querySelector("#attachments-preview");
      if (preview) preview.innerHTML = "";
    };

    ChatWidget.prototype._resetWidget = function () {
      // 1️⃣ Cerrar WebSocket si existe
      if (this.ws) {
        this.ws.disconnect();
      }

      // 2️⃣ Resetear estado SIN romper estructura
      this.state.view = "inbox";
      this.state.conversation.id = null;
      this.state.conversation.receiver = null;
      this.state.conversation.messages = [];

      this.pendingAttachments = [];
      this.pendingText = "";
      this.pendingMessageId = null;
      this.isSending = false;

      // 3️⃣ Limpiar UI
      if (this.container) {
        this.container.innerHTML = "";
      }
    };

    if (typeof window !== "undefined") {
      window.ChatWidget = ChatWidget;
    }

  return ChatWidget;

})();
