// components/ChatbotPage.tsx - CON ESTILO ORIGINAL
'use client';

import { useState, useRef, useEffect } from 'react';
import { useChatbot } from '@/hooks/useChatbot';
import { useAuthToken } from '@/hooks/useAuthToken';
import { Send, User, Bot, LogIn, BookOpen, Sparkles, GraduationCap, FileText, MapPin, BarChart3, Image as ImageIcon, Mic, XCircle } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  imageUrl?: string;
  audioUrl?: string;
}

export default function ChatbotPage() {
  const { sendMessage, isLoading } = useChatbot();
  const userContext = useAuthToken();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [selectedAudio, setSelectedAudio] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: '1',
        text: userContext.isLoggedIn 
          ? `¡Hola${userContext.nombre ? ` ${userContext.nombre}` : ''}! 👋 Soy EduBot, tu asistente educativo inteligente. Puedo ayudarte con:\n\n• 📊 Consultar tus calificaciones\n• 📖 Ver tus materias inscritas\n• 🏫 Información de aulas\n• 🎓 Orientación académica\n\n¿En qué puedo ayudarte hoy?`
          : '¡Hola! 👋 Soy EduBot, tu asistente educativo. Inicia sesión para consultar tus calificaciones y datos académicos personalizados.',
        isUser: false,
        timestamp: new Date()
      }]);
    }
  }, [userContext.isLoggedIn, userContext.nombre, messages.length]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      setSelectedAudio(file);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });
        setSelectedAudio(audioFile);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error al acceder al micrófono:', error);
      alert('No se pudo acceder al micrófono. Verifica los permisos.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const clearAttachments = () => {
    setSelectedImage(null);
    setSelectedAudio(null);
    setImagePreview('');
  };

  const handleSendMessage = async () => {
    if ((!inputMessage.trim() && !selectedImage && !selectedAudio) || isLoading) return;

    let userMessageText = inputMessage;
    let imageUrl = '';
    let audioUrl = '';

    if (selectedImage) {
      userMessageText = inputMessage || '📷 [Imagen adjunta]';
      imageUrl = imagePreview;
    }
    if (selectedAudio) {
      userMessageText = inputMessage || '🎤 [Audio adjunto]';
      audioUrl = URL.createObjectURL(selectedAudio);
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      text: userMessageText,
      isUser: true,
      timestamp: new Date(),
      imageUrl: imageUrl || undefined,
      audioUrl: audioUrl || undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');

    try {
      let response: string;

      const files: File[] = [];
      if (selectedImage) files.push(selectedImage);
      if (selectedAudio) files.push(selectedAudio);

      console.log('📤 Enviando mensaje con archivos:', {
        message: inputMessage,
        files: files.map(f => ({ name: f.name, type: f.type, size: f.size }))
      });

      response = await sendMessage(inputMessage, files, userContext);
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response,
        isUser: false,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
      clearAttachments();
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: '❌ Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta nuevamente.',
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const quickActions = [
    { label: "Mis Calificaciones", prompt: "¿Cuáles son mis calificaciones?", icon: BarChart3 },
    { label: "Mis Materias", prompt: "¿En qué materias estoy inscrito?", icon: BookOpen },
    { label: "Ubicación de Aulas", prompt: "¿Dónde son mis clases?", icon: MapPin },
    { label: "Mi Promedio", prompt: "¿Cuál es mi promedio académico?", icon: GraduationCap }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header Profesional */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200/60 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            
            {/* Logo y Branding */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 border-2 border-white rounded-full"></div>
              </div>
              
              <div className="flex flex-col">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  EduBot Assistant
                </h1>
                <p className="text-sm text-gray-500 font-medium">
                  Tu asistente educativo inteligente
                </p>
              </div>
            </div>

            {/* Estado de Usuario */}
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border transition-all duration-300 ${
                userContext.isLoggedIn 
                  ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 text-green-700 shadow-sm shadow-green-500/10' 
                  : 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 text-amber-700 shadow-sm shadow-amber-500/10'
              }`}>
                {userContext.isLoggedIn ? (
                  <>
                    <div className="relative">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      <div className="absolute inset-0 w-3 h-3 bg-green-400 rounded-full animate-ping"></div>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">Conectado</span>
                      {userContext.nombre && (
                        <span className="text-xs text-green-600">{userContext.nombre}</span>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-3 h-3 bg-amber-500 rounded-full animate-pulse"></div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">Sin conexión</span>
                      <span className="text-xs text-amber-600">Inicia sesión</span>
                    </div>
                  </>
                )}
              </div>

              {/* Botón de Acción */}
              {!userContext.isLoggedIn && (
                <a 
                  href="/login"
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl font-semibold text-sm hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-105 active:scale-95"
                >
                  Conectar
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-600" />
                Acciones Rápidas
              </h3>
              
              <div className="space-y-2">
                {quickActions.map((action, index) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={index}
                      onClick={() => {
                        setInputMessage(action.prompt);
                        setTimeout(() => handleSendMessage(), 100);
                      }}
                      disabled={!userContext.isLoggedIn || isLoading}
                      className="w-full text-left p-3 text-sm text-gray-700 bg-gray-50 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                    >
                      <Icon className="w-4 h-4" />
                      {action.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="font-medium text-gray-700 mb-3">💡 Consejos</h4>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li>• Sé específico en tus preguntas</li>
                  <li>• Pregunta por calificaciones, materias o aulas</li>
                  <li>• Usa el formato que prefieras</li>
                  <li>• Puedes enviar imágenes y audios</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Chat Area */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[calc(100vh-200px)]">
              
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-4 ${message.isUser ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      message.isUser ? 'bg-blue-600' : 'bg-gray-600'
                    }`}>
                      {message.isUser ? (
                        <User className="w-4 h-4 text-white" />
                      ) : (
                        <Bot className="w-4 h-4 text-white" />
                      )}
                    </div>
                    
                    <div className={`max-w-[70%] ${message.isUser ? 'text-right' : 'text-left'}`}>
                      <div className={`inline-block px-4 py-3 rounded-2xl ${
                        message.isUser
                          ? 'bg-blue-600 text-white rounded-br-none'
                          : 'bg-gray-100 text-gray-800 rounded-bl-none'
                      }`}>
                        {message.imageUrl && (
                          <img 
                            src={message.imageUrl} 
                            alt="Imagen enviada" 
                            className="rounded-lg mb-2 max-w-sm"
                          />
                        )}
                        {message.audioUrl && (
                          <audio controls className="mb-2">
                            <source src={message.audioUrl} type="audio/webm" />
                          </audio>
                        )}
                        <div className="whitespace-pre-wrap">{message.text}</div>
                      </div>
                      <div className={`text-xs text-gray-500 mt-1 ${
                        message.isUser ? 'text-right' : 'text-left'
                      }`}>
                        {message.timestamp.toLocaleTimeString('es-ES', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </div>
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-gray-100 text-gray-800 px-4 py-3 rounded-2xl rounded-bl-none">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="border-t border-gray-200 p-6">
                
                {/* Preview attachments */}
                {(selectedImage || selectedAudio) && (
                  <div className="mb-3 flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    {selectedImage && (
                      <div className="flex items-center gap-2">
                        <img src={imagePreview} alt="Preview" className="w-12 h-12 object-cover rounded" />
                        <span className="text-sm text-gray-700">Imagen seleccionada</span>
                      </div>
                    )}
                    {selectedAudio && (
                      <div className="flex items-center gap-2">
                        <Mic className="w-4 h-4 text-blue-600" />
                        <span className="text-sm text-gray-700">Audio seleccionado</span>
                      </div>
                    )}
                    <button
                      onClick={clearAttachments}
                      className="ml-auto p-1 hover:bg-blue-100 rounded-full transition-colors"
                    >
                      <XCircle className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                )}

                <div className="flex gap-4">
                  
                  {/* Attachment buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={!userContext.isLoggedIn || isLoading}
                      className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Adjuntar imagen"
                    >
                      <ImageIcon className="w-5 h-5" />
                    </button>
                    
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={!userContext.isLoggedIn || isLoading}
                      className={`p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        isRecording 
                          ? 'text-red-600 bg-red-50 hover:bg-red-100' 
                          : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'
                      }`}
                      title={isRecording ? "Detener grabación" : "Grabar audio"}
                    >
                      <Mic className="w-5 h-5" />
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                    <input
                      ref={audioInputRef}
                      type="file"
                      accept="audio/*"
                      onChange={handleAudioSelect}
                      className="hidden"
                    />
                  </div>

                  <div className="flex-1 relative">
                    <textarea
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder={
                        userContext.isLoggedIn
                          ? "Escribe tu mensaje... (Presiona Enter para enviar)"
                          : "Inicia sesión para chatear con EduBot..."
                      }
                      disabled={!userContext.isLoggedIn || isLoading}
                      rows={1}
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                      style={{ minHeight: '48px', maxHeight: '120px' }}
                    />
                  </div>
                  
                  <button
                    onClick={handleSendMessage}
                    disabled={(!inputMessage.trim() && !selectedImage && !selectedAudio) || !userContext.isLoggedIn || isLoading}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Enviar
                  </button>
                </div>
                
                {!userContext.isLoggedIn && (
                  <div className="mt-3 text-center">
                    <p className="text-sm text-gray-600">
                      💡 Necesitas{' '}
                      <a href="/login" className="text-blue-600 hover:text-blue-700 font-medium underline">
                        iniciar sesión
                      </a>{' '}
                      para consultar tus datos académicos
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}