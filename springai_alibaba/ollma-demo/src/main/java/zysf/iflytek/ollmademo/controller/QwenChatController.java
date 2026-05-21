package zysf.iflytek.ollmademo.controller;

import com.alibaba.cloud.ai.dashscope.chat.DashScopeChatOptions;

import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/qwen")
public class QwenChatController {
    private final ChatModel chatModel;

    public QwenChatController(ChatModel chatModel1) {
        this.chatModel = chatModel1;
    }


    @GetMapping("/simple")
    public String simple(@RequestParam(name = "query") String query){
        return chatModel.call(query);
    }
    @GetMapping("/message")
    public String message(@RequestParam(name = "query") String query) {
        SystemMessage systemMessage = new SystemMessage( "你是一个有用的AI助手。");
        UserMessage userMessage = new UserMessage(query);
        return chatModel.call(systemMessage,userMessage);
    }

    @GetMapping("/chatOptions")
    public ChatResponse chatOptions(@RequestParam(name = "query") String query) {
        SystemMessage systemMessage = new SystemMessage("你是一个有用的AI助手。");
        UserMessage userMessage = new UserMessage(query);

        DashScopeChatOptions dashScopeChatOptions = new DashScopeChatOptions();
        dashScopeChatOptions.setModel("deepseek-v3.2");
        dashScopeChatOptions.setTemperature(0.0);
        dashScopeChatOptions.setMaxInputTokens(15536);

        Prompt prompt = new Prompt(List.of(systemMessage, userMessage), dashScopeChatOptions);

        return chatModel.call(prompt);
    }
}
