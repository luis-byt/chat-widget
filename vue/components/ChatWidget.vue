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
    token: localStorage.getItem("auth_token"),
    currentUserId: Number(localStorage.getItem("user_id")),
    isDoctor: false,

    apiBaseUrl: import.meta.env.VITE_API_URL + "/chat/v1",
    wsBaseUrl: import.meta.env.VITE_WS_URL,

    logo: "PONER_AKI_CLASS_LOGO", //Ejemplo: "fa-solid fa-comment-dots" esta clase se colocaria en un <i class="fa-solid fa-comment-dots"></i> asi
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
