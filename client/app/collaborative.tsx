import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCollaborative } from "@/src/hooks/useCollaborative";
import { PresenceIndicators } from "@/src/components/PresenceIndicators";
import { CollaborativeTaskItem } from "@/src/components/CollaborativeTaskItem";
import { ConnectionStatus } from "@/src/components/ConnectionStatus";

// You would get these from user authentication
const CURRENT_USER_ID = "user_123";
const ROOM_ID = "shared_tasks";

export default function CollaborativeTasksScreen() {
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isAddingTask, setIsAddingTask] = useState(false);

  const {
    sharedState,
    participants,
    editLocks,
    isConnected,
    updateTask,
    addTask,
    deleteTask,
    requestEditLock,
    releaseEditLock,
    setUserActivity,
  } = useCollaborative(CURRENT_USER_ID, ROOM_ID);

  // Track user activity
  useEffect(() => {
    const handleFocus = () => setUserActivity(true);
    const handleBlur = () => setUserActivity(false);

    // For web
    if (typeof window !== "undefined") {
      window.addEventListener("focus", handleFocus);
      window.addEventListener("blur", handleBlur);

      return () => {
        window.removeEventListener("focus", handleFocus);
        window.removeEventListener("blur", handleBlur);
      };
    }
  }, [setUserActivity]);

  const handleAddTask = async () => {
    if (!newTaskTitle.trim() || isAddingTask) return;

    setIsAddingTask(true);
    try {
      const taskId = `task_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      await addTask(taskId, {
        id: taskId,
        title: newTaskTitle.trim(),
        completed: false,
        createdAt: new Date().toISOString(),
      });
      setNewTaskTitle("");
    } catch (error) {
      console.error("Error adding task:", error);
      Alert.alert("Error", "Failed to add task. Please try again.");
    } finally {
      setIsAddingTask(false);
    }
  };

  const getEditLockInfo = (taskId: string) => {
    const lock = editLocks.find((l) => l.field === `task_${taskId}_title`);
    return {
      isLocked: !!lock,
      lockedBy: lock?.userName,
    };
  };

  const tasks = Object.values(sharedState.tasks || {}).sort(
    (a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const renderTask = ({ item }: { item: any }) => {
    const lockInfo = getEditLockInfo(item.id);

    return (
      <CollaborativeTaskItem
        task={item}
        currentUserId={CURRENT_USER_ID}
        isLocked={lockInfo.isLocked}
        lockedBy={lockInfo.lockedBy}
        onUpdate={updateTask}
        onDelete={deleteTask}
        onRequestEditLock={requestEditLock}
        onReleaseEditLock={releaseEditLock}
      />
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
      <View className="flex-1 px-5 pt-8 md:px-8 lg:px-12 max-w-4xl mx-auto">
        <Text className="text-3xl md:text-4xl font-bold text-center mb-8 text-gray-800 dark:text-white">
          Collaborative Tasks
        </Text>

        {/* Connection Status */}
        <ConnectionStatus />

        {/* Presence Indicators */}
        <PresenceIndicators
          participants={participants}
          currentUserId={CURRENT_USER_ID}
        />

        {/* Add Task Input */}
        <View className="flex-row mb-5 md:mb-6">
          <TextInput
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg p-3 md:p-4 bg-white dark:bg-gray-800 text-base dark:text-white mr-2 md:mr-3"
            placeholder="Add a collaborative task..."
            placeholderTextColor="#9CA3AF"
            value={newTaskTitle}
            onChangeText={setNewTaskTitle}
            onSubmitEditing={handleAddTask}
            editable={!isAddingTask}
          />
          <TouchableOpacity
            className={`rounded-lg px-5 py-3 md:px-6 md:py-4 justify-center ${
              isAddingTask ? "bg-gray-400" : "bg-blue-500 active:bg-blue-600"
            }`}
            onPress={handleAddTask}
            disabled={isAddingTask || !newTaskTitle.trim()}>
            {isAddingTask ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text className="text-white font-semibold text-base">Add</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Task List */}
        <FlatList
          data={tasks}
          renderItem={renderTask}
          keyExtractor={(item) => item.id}
          className="flex-1"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="items-center py-8">
              <Text className="text-gray-500 dark:text-gray-400 text-center">
                No collaborative tasks yet.{"\n"}Add one to get started!
              </Text>
            </View>
          }
        />

        {/* Summary */}
        <View className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <Text className="text-center text-blue-700 dark:text-blue-300 text-sm font-medium">
            {tasks.length} total tasks •{" "}
            {tasks.filter((t: any) => !t.completed).length} pending
            {isConnected && participants.length > 0 && (
              <Text className="text-green-600 dark:text-green-400">
                {" "}
                • {participants.length + 1} collaborators
              </Text>
            )}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
