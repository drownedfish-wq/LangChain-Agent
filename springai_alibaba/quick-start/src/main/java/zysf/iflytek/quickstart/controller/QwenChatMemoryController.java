package zysf.iflytek.quickstart.controller;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.ai.chat.memory.repository.jdbc.JdbcChatMemoryRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/qwenmemory")
public class QwenChatMemoryController {

    private final ChatClient chatClient;

    public QwenChatMemoryController(ChatClient.Builder builder, JdbcChatMemoryRepository jdbcChatMemoryRepository) {
        // 创建 ChatMemory
        MessageWindowChatMemory messageWindowChatMemory = MessageWindowChatMemory.builder()
                .chatMemoryRepository(jdbcChatMemoryRepository)
                .maxMessages(10)
                .build();

        // 创建 Advisor
        MessageChatMemoryAdvisor memoryAdvisor = MessageChatMemoryAdvisor.builder(messageWindowChatMemory)
                .build();

        // 创建 ChatClient
        this.chatClient = builder
                .defaultAdvisors(memoryAdvisor)
                .build();
    }

    @GetMapping("/messageChatMemoryAdvisor")
    public String messageChatMemoryAdvisor(@RequestParam(name = "query") String query,
                                           @RequestParam(name = "conversationId") String conversationId) {
        return chatClient.prompt()
                .user(query)
                // 把会话id存入上下文
                .advisors(advisorSpec -> advisorSpec.param(ChatMemory.CONVERSATION_ID, conversationId))
                .call()
                .content();
    }
}
