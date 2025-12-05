import React from 'react';
import { View } from 'react-native';
import { CollaborativeTaskItem } from './CollaborativeTaskItem';
import { TaskSyncStatus } from './TaskSyncStatus';

interface OfflineTaskItemProps {
  task: any;
  currentUserId: string;
  isLocked?: boolean;
  lockedBy?: string;
  onUpdate: (taskId: string, updates: any) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
  onRequestEditLock: (field: string) => Promise<boolean>;
  onReleaseEditLock: (field: string) => Promise<void>;
}
export const OfflineTaskItem: React.FC<OfflineTaskItemProps> = (props) => {
  return (
    <View>
      <CollaborativeTaskItem {...props} />
      
      {/* Sync status indicator */}
      {props.task.syncStatus && props.task.syncStatus !== 'synced' && (
        <View className="px-4 pb-2">
          <TaskSyncStatus syncStatus={props.task.syncStatus} size="small" />
        </View>
      )}
    </View>
  );
};