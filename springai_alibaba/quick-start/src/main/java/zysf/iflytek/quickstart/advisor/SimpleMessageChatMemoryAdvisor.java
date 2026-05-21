package zysf.iflytek.quickstart.advisor;

import lombok.extern.slf4j.Slf4j;

import org.springframework.ai.chat.client.ChatClientRequest;
import org.springframework.ai.chat.client.ChatClientResponse;
import org.springframework.ai.chat.client.advisor.api.BaseAdvisor;
import org.springframework.ai.chat.client.advisor.api.AdvisorChain;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.prompt.Prompt;

import java.util.*;

@Slf4j
public class SimpleMessageChatMemoryAdvisor implements BaseAdvisor{
    private static Map<String, List<Message>> chatMemory = new HashMap<>();
    @Override
    public ChatClientRequest before(ChatClientRequest chatClientRequest, AdvisorChain advisorChain) {
        // 通过会话id查询之前的对话记录
        //String conversationId = "ydh";
        String conversationId = chatClientRequest.context().get("conversationId").toString();
        List<Message> myHisMsgList = chatMemory.get(conversationId);
        if (Objects.isNull(myHisMsgList)) {

            myHisMsgList = new ArrayList<>();
        }

        // 把此次请求的消息添加到对话记录中
        List<Message> reqMessageList = chatClientRequest.prompt().getInstructions();
        myHisMsgList.addAll(reqMessageList);
        chatMemory.put(conversationId, myHisMsgList); //把此次请求的消息存入对话记录中

        // 把添加记录后的 List<Message> 放入请求链中
        Prompt oldPrompt = chatClientRequest.prompt();
        Prompt newPrompt = oldPrompt.mutate()
                .messages(myHisMsgList)
                .build();
        ChatClientRequest request = chatClientRequest.mutate()
                .prompt(newPrompt)
                .build();

        return request;
    }

    @Override
    public ChatClientResponse after(ChatClientResponse chatClientResponse, AdvisorChain advisorChain) {
        // 通过会话id查询之前的对话记录
        String conversationId = "ydh";
        List<Message> myHisMsgList = chatMemory.get(conversationId);
        if (Objects.isNull(myHisMsgList)) {
            myHisMsgList = new ArrayList<>();
        }

        // 获取 response 中的ai消息 添加到对话记录中
        if (Objects.isNull(chatClientResponse)) {
            return chatClientResponse;
        }

        AssistantMessage assistantMessage = chatClientResponse.chatResponse()
                .getResult()
                .getOutput();
        myHisMsgList.add(assistantMessage);
        chatMemory.put(conversationId, myHisMsgList);

        return chatClientResponse;
    }

    @Override
    public int getOrder() {
        return 0;
    }

}
