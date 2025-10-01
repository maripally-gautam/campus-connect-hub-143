import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Bot, Users, Send } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Message {
  id: string;
  content: string;
  sender_id: string | null;
  is_ai: boolean;
  created_at: string;
  profiles?: {
    username: string;
    is_deleted: boolean;
  };
}

interface Chat {
  id: string;
  type: string;
  participant1_id: string | null;
  participant2_id: string | null;
  profiles?: {
    username: string;
    is_deleted: boolean;
  };
}

export default function Chats() {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchChats();
  }, [user]);

  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat.id);
      
      // Subscribe to new messages
      const subscription = supabase
        .channel(`messages-${selectedChat.id}`)
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages',
            filter: `chat_id=eq.${selectedChat.id}`
          }, 
          () => {
            fetchMessages(selectedChat.id);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [selectedChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchChats = async () => {
    try {
      // Get all users for private chats (exclude deleted users)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, is_deleted')
        .neq('user_id', user?.id)
        .eq('is_deleted', false)
        .order('username');

      // Get everyone chat
      const { data: everyoneChat } = await supabase
        .from('chats')
        .select('*')
        .eq('type', 'everyone')
        .single();

      // Get or create bot chat
      let botChat = await supabase
        .from('chats')
        .select('*')
        .eq('type', 'bot')
        .eq('participant1_id', user?.id)
        .maybeSingle();

      if (!botChat.data) {
        const { data: newBotChat } = await supabase
          .from('chats')
          .insert({ type: 'bot', participant1_id: user?.id })
          .select()
          .single();
        botChat.data = newBotChat;
      }

      // Get existing private chats
      const { data: existingChats } = await supabase
        .from('chats')
        .select('*')
        .eq('type', 'private')
        .eq('participant1_id', user?.id);

      // Get profiles for existing chats
      const chatProfiles = existingChats ? await Promise.all(
        existingChats.map(async (chat) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, is_deleted')
            .eq('user_id', chat.participant2_id)
            .single();
          return { ...chat, profiles: profile };
        })
      ) : [];

      const allChats = [
        { ...everyoneChat, displayName: 'Everyone' },
        { ...botChat.data, displayName: 'Chatbot' },
        ...(chatProfiles || []).map(chat => ({
          ...chat,
          displayName: chat.profiles?.username || 'Unknown'
        })),
        ...(profiles || []).filter(profile => 
          !existingChats?.some(chat => chat.participant2_id === profile.user_id)
        ).map(profile => ({
          id: null,
          type: 'private',
          participant1_id: user?.id,
          participant2_id: profile.user_id,
          displayName: profile.username,
          profiles: profile
        }))
      ];

      setChats(allChats as any);
      
      // Auto-select Everyone chat
      if (everyoneChat) {
        setSelectedChat({ ...everyoneChat, displayName: 'Everyone' } as any);
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (chatId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get profiles for messages
      const messagesWithProfiles = await Promise.all(
        (data || []).map(async (message) => {
          if (message.sender_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('username, is_deleted')
              .eq('user_id', message.sender_id)
              .single();
            return { ...message, profiles: profile };
          }
          return message;
        })
      );

      setMessages(messagesWithProfiles);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleSelectChat = async (chat: Chat) => {
    // Create private chat if it doesn't exist
    if (!chat.id && chat.type === 'private') {
      const { data: newChat, error } = await supabase
        .from('chats')
        .insert({
          type: 'private',
          participant1_id: user?.id,
          participant2_id: chat.participant2_id
        })
        .select()
        .single();

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }

      setSelectedChat(newChat);
      fetchChats(); // Refresh chats list
    } else {
      setSelectedChat(chat);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChat) return;

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          chat_id: selectedChat.id,
          sender_id: user?.id,
          content: newMessage,
          is_ai: false
        });

      if (error) throw error;

      setNewMessage('');

      // If it's a bot chat, get AI response
      if (selectedChat.type === 'bot') {
        // Get last 10 messages for context
        const recentMessages = messages.slice(-10).concat({
          id: 'temp',
          content: newMessage,
          sender_id: user?.id || null,
          is_ai: false,
          created_at: new Date().toISOString()
        });

        const { data, error: aiError } = await supabase.functions.invoke('chatbot', {
          body: { 
            chatId: selectedChat.id,
            messages: recentMessages.map(m => ({
              role: m.is_ai ? 'assistant' : 'user',
              content: m.content
            }))
          }
        });

        if (aiError) throw aiError;
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading chats...</div>;
  }

  return (
    <div className="h-[calc(100vh-180px)] flex gap-4">
      {/* Chat List */}
      <Card className="w-64 flex flex-col">
        <CardHeader>
          <CardTitle className="text-lg">Chats</CardTitle>
        </CardHeader>
        <ScrollArea className="flex-1">
          <div className="space-y-1 p-4">
            {chats.map((chat, index) => (
              <Button
                key={chat.id || index}
                variant={selectedChat?.id === chat.id ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                onClick={() => handleSelectChat(chat)}
              >
                {chat.type === 'everyone' && <Users className="h-4 w-4 mr-2" />}
                {chat.type === 'bot' && <Bot className="h-4 w-4 mr-2" />}
                {chat.type === 'private' && <MessageSquare className="h-4 w-4 mr-2" />}
                {(chat as any).displayName}
              </Button>
            ))}
          </div>
        </ScrollArea>
      </Card>

      {/* Messages */}
      <Card className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {selectedChat.type === 'everyone' && <Users className="h-5 w-5" />}
                {selectedChat.type === 'bot' && <Bot className="h-5 w-5" />}
                {selectedChat.type === 'private' && <MessageSquare className="h-5 w-5" />}
                {(selectedChat as any).displayName}
              </CardTitle>
            </CardHeader>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[70%] ${message.sender_id === user?.id ? 'bg-primary text-primary-foreground' : 'bg-secondary'} rounded-lg p-3`}>
                      {message.sender_id !== user?.id && !message.is_ai && (
                        <div className="text-xs font-semibold mb-1">
                          {message.profiles?.username}
                          {message.profiles?.is_deleted && (
                            <span className="text-muted-foreground ml-1">(deleted user)</span>
                          )}
                        </div>
                      )}
                      {message.is_ai && (
                        <div className="text-xs font-semibold mb-1 flex items-center gap-1">
                          <Bot className="h-3 w-3" />
                          AI Assistant
                        </div>
                      )}
                      <div className="text-sm">{message.content}</div>
                      <div className="text-xs mt-1 opacity-70">
                        {new Date(message.created_at).toLocaleTimeString('en-GB', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
            <CardContent className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <Button onClick={handleSendMessage}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </>
        ) : (
          <CardContent className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Select a chat to start messaging</p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}