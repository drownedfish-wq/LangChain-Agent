package zysf.iflytek.quickstart.advisor;

import lombok.extern.slf4j.Slf4j;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.advisor.api.CallAdvisor;
import org.springframework.ai.chat.client.advisor.api.CallAdvisorChain;
import org.springframework.ai.chat.client.ChatClientRequest;
import org.springframework.ai.chat.client.ChatClientResponse;

@Slf4j
public class YdhCallAdvisor2 implements CallAdvisor {

    @Override
    public ChatClientResponse adviseCall(ChatClientRequest chatClientRequest, CallAdvisorChain callAdvisorChain) {
        log.info("YdhCallAdvisor2 请求。");

        ChatClientResponse chatClientResponse = callAdvisorChain.nextCall(chatClientRequest);

        log.info("YdhCallAdvisor2 响应");
        return chatClientResponse;
    }

    @Override
    public String getName() {
        return "YdhCallAdvisor2";
    }

    @Override
    public int getOrder() {
        return 2;
    }
}