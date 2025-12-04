import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';

interface Task {
  id: string;
  title: string;
  completed: boolean;
  lastModifiedBy?: string;
  lastModifiedAt?: string;
}
interface CollaborativeTaskItemProps {
  task: Task;
  currentUserId: string;
  isLocked?: boolean;
  lockedBy?: string;
  onUpdate: (taskId: string, updates: any) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
  onRequestEditLock: (field: string) => Promise<boolean>;
  onReleaseEditLock: (field: string) => Promise<void>;
}
export const CollaborativeTaskItem: React.FC<CollaborativeTaskItemProps> = ({
  task,
  currentUserId,
  isLocked = false,
  lockedBy,
  onUpdate,
  onDelete,
  onRequestEditLock,
  onReleaseEditLock,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(task.title);
  const [hasEditLock, setHasEditLock] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const handleStartEdit = async () => {
    if (isLocked && lockedBy !== currentUserId) {
      Alert.alert(
        'Task Being Edited',
        `This task is currently being edited by ${lockedBy}. Please try again later.`,
        [{ text: 'OK' }]
      );
      return;
    }
    const lockObtained = await onRequestEditLock(`task_${task.id}_title`);
    
    if (lockObtained) {
      setHasEditLock(true);
      setIsEditing(true);
      setEditText(task.title);
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      Alert.alert(
        'Cannot Edit',
        'This task is being edited by another user.',
        [{ text: 'OK' }]
      );
    }
  };
  const handleSaveEdit = async () => {
    if (editText.trim() && editText !== task.title) {
      await onUpdate(task.id, { title: editText.trim() });
    }
    
    await handleCancelEdit();
  };
  const handleCancelEdit = async () => {
    setIsEditing(false);
    setEditText(task.title);
    
    if (hasEditLock) {
      await onReleaseEditLock(`task_${task.id}_title`);
      setHasEditLock(false);
    }
  };
  const handleToggleComplete = async () => {
    await onUpdate(task.id, { completed: !task.completed });
  };
  const handleDelete = () => {
    Alert.alert(
      'Delete Task',
      'Are you sure you want to delete this task?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: () => onDelete(task.id)
        },
      ]
    );
  };
  const isModifiedByOther = task.lastModifiedBy && task.lastModifiedBy !== currentUserId;
  return (
    <View className={`bg-white dark:bg-gray-800 rounded-xl mb-2 p-4 shadow-sm border ${
      isLocked && lockedBy !== currentUserId 
        ? 'border-yellow-300 dark:border-yellow-600' 
        : 'border-gray-100 dark:border-gray-700'
    }`}>
      {/* Lock indicator */}
      {isLocked && lockedBy !== currentUserId && (
        <View className="flex-row items-center mb-2">
          <View className="w-2 h-2 bg-yellow-500 rounded-full mr-2" />
          <Text className="text-xs text-yellow-600 dark:text-yellow-400">
            Being edited by {lockedBy}
          </Text>
        </View>
      )}
      <View className="flex-row items-center justify-between">
        <View className="flex-1 mr-3">
          {isEditing ? (
            <View className="flex-row items-center">
              <TextInput
                ref={inputRef}
                className="flex-1 text-base text-gray-800 dark:text-white border-b border-blue-500 pb-1"
                value={editText}
                onChangeText={setEditText}
                onSubmitEditing={handleSaveEdit}
                onBlur={handleCancelEdit}
                multiline
              />
              <TouchableOpacity
                className="ml-2 bg-blue-500 rounded px-3 py-1"
                onPress={handleSaveEdit}
              >
                <Text className="text-white text-sm">Save</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onLongPress={handleStartEdit}
              onPress={handleToggleComplete}
              disabled={isLocked && lockedBy !== currentUserId}
            >
              <Text className={`text-base ${
                task.completed 
                  ? 'text-gray-500 dark:text-gray-400 line-through' 
                  : 'text-gray-800 dark:text-white'
              }`}>
                {task.title}
              </Text>
              {isModifiedByOther && (
                <Text className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Modified by {task.lastModifiedBy} • {
                    new Date(task.lastModifiedAt!).toLocaleTimeString()
                  }
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
        
        <View className="flex-row items-center">
          <View className={`w-6 h-6 rounded-full border-2 mr-3 items-center justify-center ${
            task.completed 
              ? 'bg-green-500 border-green-500' 
              : 'border-gray-300 dark:border-gray-600'
          }`}>
            {task.completed && (
              <Text className="text-white text-xs">✓</Text>
            )}
          </View>
          
          <TouchableOpacity
            className="p-2 active:bg-gray-100 dark:active:bg-gray-700 rounded-full"
            onPress={handleDelete}
            disabled={isLocked && lockedBy !== currentUserId}
          >
            <Text className="text-red-500 text-lg">🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};