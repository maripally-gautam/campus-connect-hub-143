import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Bell, Clock, Edit } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Todo {
  id: string;
  task: string;
  completed: boolean;
  reminder_time: string | null;
  created_at: string;
  user_id: string;
}

export default function TodoList() {
  const { user } = useAuth();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTask, setEditTask] = useState('');

  useEffect(() => {
    fetchTodos();
    checkNotificationPermission();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('todos-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'todos',
          filter: `user_id=eq.${user?.id}`
        }, 
        (payload) => {
          fetchTodos();
          if (payload.eventType === 'INSERT' && payload.new.reminder_time && Notification.permission === 'granted') {
            scheduleNotification(payload.new.task, new Date(payload.new.reminder_time));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user?.id]);

  const checkNotificationPermission = () => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      
      if (permission === 'denied') {
        toast({
          title: 'Notifications Blocked',
          description: 'Please allow permissions for notifications to set reminders',
          variant: 'destructive'
        });
      }
    }
  };

  const fetchTodos = async () => {
    try {
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTodos(data || []);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const addTodo = async () => {
    if (!newTask.trim()) {
      toast({ title: 'Error', description: 'Task cannot be empty', variant: 'destructive' });
      return;
    }

    try {
      const reminderDate = reminderTime ? new Date(reminderTime).toISOString() : null;

      if (reminderDate && notificationPermission !== 'granted') {
        toast({ title: 'Permission required', description: 'Notification permission is required to set reminders.', variant: 'destructive' });
        return;
      }
      const { error } = await supabase
        .from('todos')
        .insert([{
          task: newTask,
          user_id: user?.id,
          reminder_time: reminderDate
        }]);

      if (error) throw error;

      // Schedule notification if reminder is set
      if (reminderDate && notificationPermission === 'granted') {
        scheduleNotification(newTask, new Date(reminderTime));
      }

      setNewTask('');
      setReminderTime('');
      toast({ title: 'Success', description: 'Task added successfully!' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const scheduleNotification = (task: string, reminderDate: Date) => {
    const now = new Date();
    const timeDiff = reminderDate.getTime() - now.getTime();
    
    if (timeDiff > 0) {
      setTimeout(() => {
        if (Notification.permission === 'granted') {
          new Notification('EduConnect Reminder', {
            body: `Don't forget: ${task}`,
            icon: '/favicon.ico'
          });
        }
      }, timeDiff);
    }
  };

  const toggleTodo = async (todoId: string, completed: boolean) => {
    try {
      const { error } = await supabase
        .from('todos')
        .update({ completed: !completed })
        .eq('id', todoId);

      if (error) throw error;
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const editTodo = async (todoId: string) => {
    if (!editTask.trim()) {
      toast({ title: 'Error', description: 'Task cannot be empty', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase
        .from('todos')
        .update({ task: editTask })
        .eq('id', todoId);

      if (error) throw error;
      
      setEditingId(null);
      setEditTask('');
      toast({ title: 'Success', description: 'Task updated successfully!' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const deleteTodo = async (todoId: string) => {
    try {
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', todoId);

      if (error) throw error;
      toast({ title: 'Success', description: 'Task deleted successfully!' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const deleteCompletedTasks = async () => {
    const completedTasks = todos.filter(todo => todo.completed);
    
    if (completedTasks.length === 0) {
      toast({ title: 'Info', description: 'No completed tasks to delete', variant: 'default' });
      return;
    }

    if (!confirm(`Delete ${completedTasks.length} completed task(s)?`)) return;

    try {
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('user_id', user?.id)
        .eq('completed', true);

      if (error) throw error;
      toast({ title: 'Success', description: `${completedTasks.length} completed tasks deleted!` });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-[200px]">
        <div className="fixed top-0 left-0 right-0 z-50 h-1 overflow-hidden">
          <div className="h-full w-1/3 animate-[progress_1.2s_ease-in-out_infinite] rounded-r bg-primary" />
        </div>
      </div>
    );
  }

  const activeTodos = todos.filter(todo => !todo.completed);
  const completedTodos = todos.filter(todo => todo.completed);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-foreground">To Do List</h1>
        {completedTodos.length > 0 && (
          <Button variant="outline" onClick={deleteCompletedTasks}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Completed ({completedTodos.length})
          </Button>
        )}
      </div>

      {/* Add New Task */}
      <Card>
        <CardHeader>
          <CardTitle>Add New Task</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="What do you need to do?"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTodo(); } }}
          />
          
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <Input
                type="datetime-local"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>
            
            {notificationPermission !== 'granted' && reminderTime && (
              <Button variant="outline" onClick={requestNotificationPermission}>
                <Bell className="h-4 w-4 mr-2" />
                Enable Notifications
              </Button>
            )}
          </div>
          
          <Button onClick={addTodo} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Task
          </Button>
        </CardContent>
      </Card>

      {/* Active Tasks */}
      {activeTodos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Tasks ({activeTodos.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeTodos.map((todo) => (
              <div key={todo.id} className="flex items-center gap-3 p-3 bg-secondary/20 rounded-lg">
                <Checkbox
                  checked={todo.completed}
                  onCheckedChange={() => toggleTodo(todo.id, todo.completed)}
                />
                
                <div className="flex-1">
                  {editingId === todo.id ? (
                    <div className="flex gap-2">
                      <Input
                        value={editTask}
                        onChange={(e) => setEditTask(e.target.value)}
                        className="flex-1"
                      />
                      <Button size="sm" onClick={() => editTodo(todo.id)}>
                        Save
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          setEditingId(null);
                          setEditTask('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="text-foreground">{todo.task}</div>
                      {todo.reminder_time && (
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(todo.reminder_time).toLocaleString()}
                        </div>
                      )}
                    </>
                  )}
                </div>
                
                {editingId !== todo.id && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingId(todo.id);
                        setEditTask(todo.task);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteTodo(todo.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Completed Tasks */}
      {completedTodos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Completed Tasks ({completedTodos.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {completedTodos.map((todo) => (
              <div key={todo.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg opacity-60">
                <Checkbox
                  checked={todo.completed}
                  onCheckedChange={() => toggleTodo(todo.id, todo.completed)}
                />
                
                <div className="flex-1">
                  <div className="text-foreground line-through">{todo.task}</div>
                  {todo.reminder_time && (
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(todo.reminder_time).toLocaleString()}
                    </div>
                  )}
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteTodo(todo.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {todos.length === 0 && (
        <Card>
          <CardContent className="text-center p-8">
            <p className="text-muted-foreground">No tasks yet. Add your first task above!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}