// lib/geminiService.ts - Servicio completo con soporte multimodal
import { GoogleGenerativeAI, GenerativeModel, ChatSession } from '@google/generative-ai';
import { UserContext, ChatMessage } from '../app/types/chatbot';

export class ChatbotService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: GenerativeModel | null = null;
  private chat: ChatSession | null = null;
  private isInitialized: boolean = false;
  private useFallback: boolean = false;

  constructor() {
    this.initializeService();
  }

  private initializeService(): void {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    
    if (!apiKey) {
      this.useFallback = true;
      return;
    }

    if (!apiKey.startsWith('AIza')) {
      this.useFallback = true;
      return;
    }

    if (apiKey.length < 39) {
      this.useFallback = true;
      return;
    }

    try {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      });
      
      this.testConnection();
      
    } catch (error) {
      this.useFallback = true;
    }
  }

  private async testConnection(): Promise<void> {
    if (!this.model) return;
    
    try {
      const testResult = await this.model.generateContent("Responde 'OK' si estás funcionando");
      await testResult.response;
    } catch (error) {
      this.useFallback = true;
    }
  }

  private getSystemContext(userContext?: UserContext): string {
    return `Eres "EduBot", un asistente virtual especializado en educación universitaria.

CONTEXTO DEL USUARIO:
- Nombre: ${userContext?.nombre || 'No disponible'}
- Sesión activa: ${userContext?.isLoggedIn ? 'Sí' : 'No'}
- Tiempo: ${userContext?.timestamp || 'No disponible'}

INFORMACIÓN DISPONIBLE:
Para consultar calificaciones, materias o aulas, el usuario DEBE:
1. Iniciar sesión en el sistema web
2. Acceder a la sección "Mis Calificaciones" o "Mis Materias"

RESPONDE EN ESPAÑOL con:
- Claridad y precisión
- Empatía y utilidad
- Enfoque educativo
-Idenficia la materia que el usuario tenga baja la nota y recomiendale material de apoyo
-la hora tiene que ser de ecuador

Si el usuario pide calificaciones específicas y está logueado, podrás mostrarle sus datos reales.`;
  }

  // ===== DETECCIÓN DE INTENCIONES =====
  
  private isGradeRelated(message: string): boolean {
    const gradeKeywords = ['calificacion', 'nota', 'promedio', 'calificación', 'notas', 'nota final', 'qué nota tengo', 'mis calificaciones'];
    return gradeKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
  }

  private isSubjectRelated(message: string): boolean {
    const subjectKeywords = ['materia', 'clase', 'asignatura', 'curso', 'mis materias', 'qué materias tengo', 'en qué materias estoy', 'nivel'];
    return subjectKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
  }

  private isClassroomRelated(message: string): boolean {
    const classroomKeywords = ['aula', 'salón', 'clase', 'dónde es la clase', 'dónde me toca', 'ubicación', 'lugar de clase'];
    return classroomKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
  }

  private isLevelRelated(message: string): boolean {
    const levelKeywords = ['nivel', 'semestre', 'ciclo', 'en qué nivel', 'qué nivel tengo', 'nivel de la materia'];
    return levelKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
  }

  // ===== CONSULTA DE DATOS ACADÉMICOS =====

  private async fetchUserData(token: string): Promise<any> {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/mis-inscripciones/`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        return [];
      }
      
      return data;
      
    } catch (error) {
      throw error;
    }
  }

  private generateAcademicResponse(inscripciones: any[], message: string): string {
    if (!inscripciones || inscripciones.length === 0) {
      return `📊 **Información Académica**\n\nNo se encontraron materias inscritas para tu usuario.\n\n**Por favor verifica:**\n• Que estés correctamente inscrito en el período actual\n• O contacta con la administración académica`;
    }

    const isGradeQuery = this.isGradeRelated(message);
    const isSubjectQuery = this.isSubjectRelated(message);
    const isClassroomQuery = this.isClassroomRelated(message);
    const isLevelQuery = this.isLevelRelated(message);

    if (isGradeQuery) {
      return this.generateGradeResponse(inscripciones);
    } else if (isSubjectQuery || isLevelQuery) {
      return this.generateSubjectResponse(inscripciones);
    } else if (isClassroomQuery) {
      return this.generateClassroomResponse(inscripciones);
    } else {
      return this.generateGeneralResponse(inscripciones);
    }
  }

  private generateGradeResponse(inscripciones: any[]): string {
    let response = `📊 **Tus Calificaciones**\n\n`;
    
    const inscripcionesConNota = inscripciones.filter(insc => 
      insc.calificacion !== null && insc.calificacion !== undefined
    );
    
    if (inscripcionesConNota.length === 0) {
      return `📝 **Estado de Calificaciones**\n\nTodas tus materias están pendientes de calificación.\n\n**Materias inscritas:**\n${inscripciones.map(insc => {
        const materia = insc.paralelo?.materia;
        const nivel = materia?.nivel?.nombre || 'Nivel no disponible';
        return `• ${materia?.nombre || 'Materia'} (${nivel})`;
      }).join('\n')}\n\nLas calificaciones serán publicadas por tus profesores.`;
    }
    
    inscripcionesConNota.forEach((inscripcion: any) => {
      const calificacion = inscripcion.calificacion;
      const estado = calificacion >= 7 ? '✅' : '⚠️';
      const materia = inscripcion.paralelo?.materia;
      const nivel = materia?.nivel?.nombre || 'N/A';
      
      response += `${estado} **${materia?.nombre || 'Materia no disponible'}**\n`;
      response += `   📈 Nivel: ${nivel}\n`;
      response += `   🎓 Calificación: **${calificacion}/10**\n`;
      response += `   📚 Carrera: ${inscripcion.carrera?.nombre || 'No disponible'}\n`;
      response += `   🏠 Aula: ${inscripcion.paralelo?.aula || 'No disponible'}\n`;
      response += `   👥 Paralelo: ${inscripcion.paralelo?.numero_paralelo || 'N/A'}\n\n`;
    });
    
    const promedio = inscripcionesConNota.reduce((acc: number, insc: any) => 
      acc + insc.calificacion, 0) / inscripcionesConNota.length;
    const estadoPromedio = promedio >= 7 ? '🎉' : '📈';
    
    response += `${estadoPromedio} **Promedio General: ${promedio.toFixed(2)}/10**\n\n`;
    
    if (promedio >= 9) {
      response += `¡Excelente trabajo! 🏆 Mantén ese rendimiento excepcional.`;
    } else if (promedio >= 7) {
      response += `Buen rendimiento 👍 Sigue esforzándote para alcanzar la excelencia.`;
    } else {
      response += `💡 **Consejo:** Hay oportunidad de mejorar. Considera:\n• Revisar tus técnicas de estudio\n• Pedir ayuda a tus profesores\n• Organizar mejor tu tiempo\n• Formar grupos de estudio`;
    }
    
    return response;
  }

  private generateSubjectResponse(inscripciones: any[]): string {
    let response = `📖 **Tus Materias Inscritas**\n\n`;
    
    const niveles = new Map<string, any[]>();
    
    inscripciones.forEach((inscripcion: any) => {
      const nivel = inscripcion.paralelo?.materia?.nivel?.nombre || 'Sin nivel';
      if (!niveles.has(nivel)) {
        niveles.set(nivel, []);
      }
      niveles.get(nivel)!.push(inscripcion);
    });
    
    niveles.forEach((materias, nivel) => {
      response += `📚 **${nivel}**\n`;
      materias.forEach((inscripcion: any) => {
        const materia = inscripcion.paralelo?.materia;
        const calificacion = inscripcion.calificacion || 'Sin calificar';
        
        response += `   • **${materia?.nombre || 'Materia no disponible'}**\n`;
        response += `      🏠 Aula: ${inscripcion.paralelo?.aula || 'N/A'}\n`;
        response += `      👥 Paralelo: ${inscripcion.paralelo?.numero_paralelo || 'N/A'}\n`;
        response += `      📊 Calificación: ${calificacion}/10\n`;
        response += `      🎓 Carrera: ${inscripcion.carrera?.nombre || 'N/A'}\n\n`;
      });
    });
    
    response += `📈 **Total de materias:** ${inscripciones.length}`;
    
    return response;
  }

  private generateClassroomResponse(inscripciones: any[]): string {
    let response = `🏫 **Tus Aulas y Horarios**\n\n`;
    
    inscripciones.forEach((inscripcion: any) => {
      const materia = inscripcion.paralelo?.materia;
      const nivel = materia?.nivel?.nombre || 'N/A';
      
      response += `📚 **${materia?.nombre || 'Materia no disponible'}**\n`;
      response += `   📈 Nivel: ${nivel}\n`;
      response += `   🏠 Aula: **${inscripcion.paralelo?.aula || 'No asignada'}**\n`;
      response += `   👥 Paralelo: ${inscripcion.paralelo?.numero_paralelo || 'N/A'}\n`;
      response += `   🎓 Carrera: ${inscripcion.carrera?.nombre || 'No disponible'}\n`;
      response += `   📊 Calificación actual: ${inscripcion.calificacion || 'Pendiente'}/10\n\n`;
    });
    
    return response;
  }

  private generateGeneralResponse(inscripciones: any[]): string {
    let response = `🎓 **Tu Información Académica Completa**\n\n`;
    
    const carrerasMap = new Map<string, any[]>();
    inscripciones.forEach(inscripcion => {
      const carreraNombre = inscripcion.carrera?.nombre || 'Sin carrera';
      if (!carrerasMap.has(carreraNombre)) {
        carrerasMap.set(carreraNombre, []);
      }
      carrerasMap.get(carreraNombre)!.push(inscripcion);
    });
    
    carrerasMap.forEach((materias, carrera) => {
      response += `**🎓 ${carrera}**\n`;
      
      const nivelMap = new Map<string, any[]>();
      materias.forEach(inscripcion => {
        const nivel = inscripcion.paralelo?.materia?.nivel?.nombre || 'Sin nivel';
        if (!nivelMap.has(nivel)) {
          nivelMap.set(nivel, []);
        }
        nivelMap.get(nivel)!.push(inscripcion);
      });
      
      nivelMap.forEach((materiasNivel, nivel) => {
        response += `  📈 ${nivel}:\n`;
        materiasNivel.forEach((inscripcion: any) => {
          const materia = inscripcion.paralelo?.materia;
          const nota = inscripcion.calificacion || 'N/A';
          const aula = inscripcion.paralelo?.aula || 'N/A';
          
          response += `    • ${materia?.nombre || 'Materia'} - Aula: ${aula} - Nota: ${nota}/10\n`;
        });
      });
      response += '\n';
    });
    
    const conNota = inscripciones.filter(i => i.calificacion !== null);
    const promedio = conNota.length > 0 
      ? (conNota.reduce((acc, i) => acc + i.calificacion, 0) / conNota.length).toFixed(2)
      : 'N/A';
    
    response += `📊 **Resumen:**\n`;
    response += `• Total de materias: ${inscripciones.length}\n`;
    response += `• Materias calificadas: ${conNota.length}\n`;
    response += `• Promedio general: ${promedio}/10\n`;
    
    return response;
  }

  // ===== MÉTODOS PARA MULTIMEDIA =====

  async sendMessageWithImage(
    message: string, 
    imageFile: File, 
    userContext?: UserContext
  ): Promise<string> {
    if (this.useFallback || !this.model) {
      return "El servicio de IA no está disponible. Por favor configura correctamente la API Key.";
    }

    try {
      const imageData = await this.fileToGenerativePart(imageFile);
      
      let fullPrompt = message || "Analiza esta imagen y descríbeme qué ves.";
      
      if (userContext?.isLoggedIn && userContext.nombre) {
        fullPrompt = `[Usuario: ${userContext.nombre}] ${fullPrompt}`;
      }

      const result = await this.model.generateContent([
        fullPrompt,
        imageData
      ]);

      const response = await result.response;
      return response.text();

    } catch (error) {
      console.error('Error procesando imagen:', error);
      return "Lo siento, hubo un error al procesar la imagen. Verifica que el archivo sea válido y no sea muy grande.";
    }
  }

  async sendMessageWithAudio(
    audioFile: File,
    userContext?: UserContext
  ): Promise<string> {
    try {
      const transcription = await this.transcribeAudioBrowser(audioFile);
      
      if (transcription) {
        return await this.sendMessage(transcription, userContext);
      }
      
      return "No pude transcribir el audio. Por favor intenta de nuevo hablando más claro.";
      
    } catch (error) {
      console.error('Error procesando audio:', error);
      return "Lo siento, no pude procesar el audio. Asegúrate de:\n• Hablar claramente\n• Usar un micrófono funcional\n• Dar permisos al navegador";
    }
  }

  private async fileToGenerativePart(file: File): Promise<any> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onloadend = () => {
        const base64Data = reader.result as string;
        const base64Content = base64Data.split(',')[1];
        
        resolve({
          inlineData: {
            data: base64Content,
            mimeType: file.type
          }
        });
      };
      
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private transcribeAudioBrowser(audioFile: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        reject(new Error('Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.'));
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'es-ES';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      const audioUrl = URL.createObjectURL(audioFile);
      const audio = new Audio(audioUrl);
      
      recognition.onstart = () => {
        console.log('Iniciando transcripción...');
        audio.play().catch(err => console.error('Error reproduciendo audio:', err));
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        console.log('Transcripción completa:', transcript);
        audio.pause();
        URL.revokeObjectURL(audioUrl);
        resolve(transcript);
      };

      recognition.onerror = (event: any) => {
        console.error('Error en reconocimiento:', event.error);
        audio.pause();
        URL.revokeObjectURL(audioUrl);
        
        if (event.error === 'no-speech') {
          reject(new Error('No se detectó voz en el audio'));
        } else if (event.error === 'audio-capture') {
          reject(new Error('No se pudo capturar el audio'));
        } else {
          reject(new Error(`Error de reconocimiento: ${event.error}`));
        }
      };

      recognition.onend = () => {
        console.log('Reconocimiento finalizado');
      };

      try {
        recognition.start();
      } catch (error) {
        reject(error);
      }
    });
  }

  // ===== MÉTODOS PRINCIPALES =====

  private async getFallbackResponse(message: string, userContext?: UserContext): Promise<string> {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('hola') || lowerMessage.includes('hi')) {
      return `¡Hola${userContext?.nombre ? ` ${userContext.nombre}` : ''}! 👋 Soy EduBot, tu asistente educativo.\n\nActualmente estoy en modo de demostración. Para habilitar todas mis funciones inteligentes, configura correctamente la API Key de Gemini.\n\n¿En qué puedo ayudarte?`;
    }
    
    if (this.isGradeRelated(lowerMessage)) {
      return `📊 **Consulta de Calificaciones**\n\nPara ver tus calificaciones específicas, necesitas:\n1. Iniciar sesión en la plataforma\n2. Configurar correctamente la API Key de Gemini`;
    }
    
    return `🤖 **EduBot - Modo Demostración**\n\nActualmente estoy funcionando en modo básico.\n\n**Para desbloquear todas mis funciones:**\n1. Obtén una API Key de Google Gemini\n2. Configúrala en .env.local como NEXT_PUBLIC_GEMINI_API_KEY\n\n¿En qué más puedo asistirte?`;
  }

  private async initializeChat(userContext?: UserContext): Promise<ChatSession> {
    if (this.useFallback || !this.model) {
      throw new Error('Servicio no disponible - Modo fallback activo');
    }

    if (!this.chat || !this.isInitialized) {
      const systemContext = this.getSystemContext(userContext);
      
      const initialHistory: ChatMessage[] = [
        {
          role: "user",
          parts: [{ text: systemContext }]
        },
        {
          role: "model",
          parts: [{ text: "¡Hola! Soy EduBot, tu asistente educativo inteligente. ¿En qué puedo ayudarte hoy con tus estudios?" }]
        }
      ];

      this.chat = await this.model.startChat({
        history: initialHistory,
      });

      this.isInitialized = true;
    }

    return this.chat;
  }

  async sendMessage(message: string, userContext?: UserContext): Promise<string> {
    console.log('🔍 DEBUG sendMessage:', {
      message,
      isLoggedIn: userContext?.isLoggedIn,
      hasToken: !!userContext?.token
    });

    if (userContext?.isLoggedIn && userContext.token && 
        (this.isGradeRelated(message) || this.isSubjectRelated(message) || 
         this.isClassroomRelated(message) || this.isLevelRelated(message))) {
      
      try {
        const userData = await this.fetchUserData(userContext.token);
        
        if (userData && userData.length > 0) {
          return this.generateAcademicResponse(userData, message);
        }
      } catch (error: any) {
        console.error('❌ Error en API:', error.message);
      }
    }

    if (this.useFallback) {
      return this.getFallbackResponse(message, userContext);
    }

    try {
      const chat = await this.initializeChat(userContext);
      
      let enrichedMessage = message;
      if (userContext?.nombre) {
        enrichedMessage = `[Usuario: ${userContext.nombre}] ${message}`;
      }

      const result = await chat.sendMessage(enrichedMessage);
      const response = await result.response;
      return response.text();

    } catch (error) {
      return this.getFallbackResponse(message, userContext);
    }
  }

  getServiceStatus(): { 
    available: boolean; 
    mode: 'gemini' | 'fallback'; 
    hasApiKey: boolean;
    details: string;
  } {
    return {
      available: !this.useFallback,
      mode: this.useFallback ? 'fallback' : 'gemini',
      hasApiKey: !!process.env.NEXT_PUBLIC_GEMINI_API_KEY,
      details: `useFallback: ${this.useFallback}, hasApiKey: ${!!process.env.NEXT_PUBLIC_GEMINI_API_KEY}`
    };
  }

  resetChat(): void {
    this.chat = null;
    this.isInitialized = false;
  }
}

export const chatbotService = new ChatbotService();