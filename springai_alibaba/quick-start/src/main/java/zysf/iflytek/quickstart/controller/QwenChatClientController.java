package zysf.iflytek.quickstart.controller;

import com.alibaba.cloud.ai.dashscope.chat.DashScopeChatOptions;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;
import zysf.iflytek.quickstart.advisor.SimpleMessageChatMemoryAdvisor;
import zysf.iflytek.quickstart.advisor.YdhCallAdvisor1;
import zysf.iflytek.quickstart.advisor.YdhCallAdvisor2;

import java.awt.print.Book;
import java.util.List;
import java.util.function.Consumer;

import static java.awt.SystemColor.text;

@RestController
@RequestMapping("/qwenclient")
public class QwenChatClientController {
    private final ChatClient chatClient;

    public QwenChatClientController(ChatClient.Builder builder) {
        this.chatClient = builder.build();
    }

    @GetMapping("/simple")
    public String simple(@RequestParam(name = "query") String query) {
        DashScopeChatOptions dashScopeChatOptions = DashScopeChatOptions.builder()
                .withModel("qwen-plus")
                .withTemperature(0.0)
                .withMaxToken(15536)
                .build();

        return chatClient.prompt()
                .system("你是一个有用的AI助手。")
                .user(query)
                .options(dashScopeChatOptions)
                .call()
                .content();
    }

    @GetMapping(value="/stream",produces="text/html;charset=utf-8")
    public Flux<String> stream() {
        Flux<String> content =chatClient.prompt()
                .user("给我随机生成10本书，要求书名和作者都是中文。")
                .stream()
                .content();
        return content;
    }

    @GetMapping("/entity")
    public Book response() {
        Book book = chatClient.prompt()
                .user("给我随机生成一本书，要求书名和作者都是中文。")
                .call()
                .entity(Book.class);

        return book;
    }

    @GetMapping("/booklist")
    public List<Book> bookList() {
        List<Book> bookList = chatClient.prompt()
                .user("给我随机生成10本书，要求书名和作者都是中文。")
                .call()
                .entity(new ParameterizedTypeReference<List<Book>>() {});

        return bookList;
    }
    @GetMapping("/advisor")
    public Book advisor() {
        Book book = chatClient.prompt()
                .user("给我随机生成一本书，要求书名和作者都是中文。")
            .advisors(new YdhCallAdvisor1(), new YdhCallAdvisor2())
                .call()
                .entity(Book.class);
        return book;
    }

    @GetMapping("/simpleMessageChatMemoryAdvisor")
    public String simpleMessageChatMemoryAdvisor(@RequestParam(name = "query") String query,
                                                 @RequestParam(name = "conversationId") String conversationId){
        return chatClient.prompt()
                .user(query)
                .advisors(advisorSpec -> advisorSpec.param("conversationId", conversationId))
                .advisors(new SimpleMessageChatMemoryAdvisor())
                .call()
                .content();
    }


}
