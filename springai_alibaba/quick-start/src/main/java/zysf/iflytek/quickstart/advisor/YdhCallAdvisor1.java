package zysf.iflytek.quickstart.advisor;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClientRequest;
import org.springframework.ai.chat.client.ChatClientResponse;
import org.springframework.ai.chat.client.advisor.api.CallAdvisor;
import org.springframework.ai.chat.client.advisor.api.CallAdvisorChain;

@Slf4j
public class YdhCallAdvisor1 implements CallAdvisor {

    @Override
    public ChatClientResponse adviseCall(ChatClientRequest chatClientRequest, CallAdvisorChain callAdvisorChain) {
        log.info("YdhCallAdvisor1 请求。");

        ChatClientResponse chatClientResponse = callAdvisorChain.nextCall(chatClientRequest);

        log.info("YdhCallAdvisor1 响应");
        return chatClientResponse;
    }

    @Override
    public String getName() {
        return "YdhCallAdvisor1";
    }

    @Override
    public int getOrder() {
        return 1;
    }
}