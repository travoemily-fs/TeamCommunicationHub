import "../styles/global.css";
import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useChat } from "@/src/hooks/useChat";
import { ChatMessage } from "@/src/services/chatDatabase";
import { useRouter } from "expo-router";

const CURRENT_USER_ID = "user_123";
const CURRENT_USER_NAME = "John Doe";

const ROOMS = [
  { id: "general", label: "General Chat" },
  { id: "project", label: "Group Project Chat" },
  { id: "random", label: "Misc Chat" },
];

export default function ChatScreen() {
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const router = useRouter();

  const {
    messages,
    typingUsers,
    currentRoom,
    sendMessage,
    joinRoom,
    startTyping,
    stopTyping,
    loadMoreMessages,
  } = useChat(CURRENT_USER_ID, CURRENT_USER_NAME);

  // 🚀 AUTO-JOIN GENERAL ON FIRST LOAD — BLOCK UI UNTIL JOINED
  useEffect(() => {
    if (!currentRoom) {
      joinRoom("general", "General Chat");
    }
  }, [currentRoom, joinRoom]);

  // keep list scrolled to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    // 🚨 Prevent sending until room is fully joined
    if (!currentRoom) {
      console.warn("Tried to send before room was joined");
      return;
    }

    await sendMessage(inputText.trim());
    setInputText("");
    handleStopTyping();
  };

  const handleTextChange = (text: string) => {
    setInputText(text);
    if (text.length > 0 && !isTyping) {
      setIsTyping(true);
      startTyping();
    } else if (text.length === 0 && isTyping) {
      handleStopTyping();
    }
  };

  const handleStopTyping = () => {
    if (isTyping) {
      setIsTyping(false);
      stopTyping();
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isOwnMessage = item.userId === CURRENT_USER_ID;

    return (
      <View className={`mb-3 ${isOwnMessage ? "items-end" : "items-start"}`}>
        {!isOwnMessage && (
          <Text className="text-xs text-gray-500 mb-1 ml-2">
            {item.userName}
          </Text>
        )}

        <View
          className={`max-w-3/4 p-3 rounded-2xl ${
            isOwnMessage
              ? "bg-blue-500 rounded-br-md"
              : "bg-gray-200 dark:bg-gray-700 rounded-bl-md"
          }`}>
          <Text
            className={`text-base ${
              isOwnMessage ? "text-white" : "text-gray-800 dark:text-white"
            }`}>
            {item.text}
          </Text>

          {item.reactions && Object.keys(item.reactions).length > 0 && (
            <View className="flex-row flex-wrap mt-2">
              {Object.entries(item.reactions).map(([emoji, users]) => (
                <View
                  key={emoji}
                  className="px-2 py-1 mr-1 mb-1 bg-white/20 rounded-full flex-row items-center">
                  <Text className="mr-1">{emoji}</Text>
                  <Text className="text-xs text-white">{users.length}</Text>
                </View>
              ))}
            </View>
          )}

          <View className="flex-row items-center justify-between mt-1">
            <Text
              className={`text-xs ${
                isOwnMessage
                  ? "text-blue-100"
                  : "text-gray-500 dark:text-gray-400"
              }`}>
              {new Date(item.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>

            {isOwnMessage && (
              <Text className="text-xs text-blue-100 ml-2">
                {item.delivered ? "Delivered" : "Sent"}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderTypingIndicator = () => {
    if (typingUsers.length === 0) return null;
    const typingNames = typingUsers.map((u) => u.userName).join(", ");
    return (
      <View className="items-start mb-3">
        <View className="bg-gray-200 dark:bg-gray-700 rounded-2xl rounded-bl-md px-4 py-2">
          <Text className="text-gray-600 dark:text-gray-300 text-sm italic">
            {typingNames} {typingUsers.length === 1 ? "is" : "are"} typing...
          </Text>
        </View>
      </View>
    );
  };

  // 👉 BLOCK all UI until a room is actually joined
  if (!currentRoom) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-gray-900">
        <Text className="text-white text-lg">Joining chat…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1">
        <TouchableOpacity
          onPress={() => router.push("/")}
          className="px-4 py-2 pt-5">
          <Text className="text-blue-500 text-base">Go Back</Text>
        </TouchableOpacity>

        <View className="flex-row px-4 pt-3 space-x-2">
          {ROOMS.map((room) => {
            const isActive = currentRoom === room.id;
            return (
              <TouchableOpacity
                key={room.id}
                onPress={() => joinRoom(room.id, room.label)}
                className={`px-3 py-2 rounded-full border ${
                  isActive
                    ? "bg-blue-500 border-blue-500"
                    : "bg-transparent border-gray-300 dark:border-gray-600"
                }`}>
                <Text
                  className={
                    isActive
                      ? "text-white text-sm font-semibold"
                      : "text-gray-700 dark:text-gray-200 text-sm"
                  }>
                  {room.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text className="text-lg font-semibold align-center text-gray-800 dark:text-white pt-5 pl-5">
          {currentRoom}
        </Text>

        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          className="flex-1 px-4"
          contentContainerStyle={{ paddingVertical: 16 }}
          onEndReached={loadMoreMessages}
          onEndReachedThreshold={0.1}
          ListFooterComponent={renderTypingIndicator}
          showsVerticalScrollIndicator={false}
        />

        <View className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-3">
          <View className="flex-row items-end">
            <TextInput
              className="flex-1 border border-gray-300 dark:border-gray-600 rounded-full px-4 py-2 mr=2 pl-6 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white pt-6 pb-6"
              placeholder="Type a message..."
              placeholderTextColor="#9CA3AF"
              value={inputText}
              onChangeText={handleTextChange}
              onBlur={handleStopTyping}
              maxLength={1000}
              multiline={false}
              returnKeyType="send"
              onKeyPress={(e) => {
                if (e.nativeEvent.key === "Enter") {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <TouchableOpacity
              className={`rounded-full p-6 pl-8 pr-8 ${
                inputText.trim()
                  ? "bg-blue-500 active:bg-blue-600"
                  : "bg-gray-300 dark:bg-gray-600"
              }`}
              onPress={handleSendMessage}
              disabled={!inputText.trim()}>
              <Text className="text-white font-bold">Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
