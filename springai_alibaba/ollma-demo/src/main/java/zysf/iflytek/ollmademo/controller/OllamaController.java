package zysf.iflytek.ollmademo.controller;

import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.ollama.OllamaChatModel;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/ollama")
public class OllamaController {

    private final ChatModel chatModel;

    public OllamaController(OllamaChatModel chatModel) {
        this.chatModel = chatModel;
    }

    @GetMapping("/simple")
    public String simple(@RequestParam(name = "query") String query) {
        // 调用模型
        return chatModel.call(query);
    }
}