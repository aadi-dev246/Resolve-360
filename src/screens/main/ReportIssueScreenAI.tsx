import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import {COLORS, TYPOGRAPHY, SPACING} from '../../utils/constants';
import {classifyIssue, analyzeIssueContent, processVoiceInput, getSmartSuggestions, AIClassificationResult, AIAnalysisResult} from '../../services/aiService';

interface IssueData {
  title: string;
  description: string;
  category: string;
  priority: string;
  images: string[];
  location: {
    latitude: number;
    longitude: number;
    address: string;
  } | null;
  voiceNote?: string;
}

const CATEGORIES = [
  {id: 'roads', name: '🛣️ Roads & Traffic', color: '#FF6B6B'},
  {id: 'water', name: '💧 Water Supply', color: '#4ECDC4'},
  {id: 'electricity', name: '⚡ Electricity', color: '#FFE66D'},
  {id: 'waste', name: '🗑️ Waste Management', color: '#95E1D3'},
  {id: 'public', name: '🏛️ Public Facilities', color: '#A8E6CF'},
  {id: 'other', name: '📝 Other', color: '#C7CEEA'},
];

const PRIORITIES = [
  {id: 'low', name: 'Low', color: '#4CAF50'},
  {id: 'medium', name: 'Medium', color: '#FF9800'},
  {id: 'high', name: 'High', color: '#F44336'},
  {id: 'critical', name: 'Critical', color: '#9C27B0'},
];

const ReportIssueScreenAI: React.FC = () => {
  const [issueData, setIssueData] = useState<IssueData>({
    title: '',
    description: '',
    category: '',
    priority: '',
    images: [],
    location: null,
  });
  
  const [aiClassification, setAiClassification] = useState<AIClassificationResult | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [smartSuggestions, setSmartSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [showAiInsights, setShowAiInsights] = useState(false);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  useEffect(() => {
    if (issueData.title.length > 5 && issueData.description.length > 10) {
      runAIAnalysis();
    }
  }, [issueData.title, issueData.description]);

  const getCurrentLocation = async () => {
    try {
      const {status} = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const address = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      setIssueData(prev => ({
        ...prev,
        location: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          address: address[0] ? `${address[0].street}, ${address[0].city}` : 'Unknown location',
        },
      }));

      // Get smart suggestions based on location
      const suggestions = await getSmartSuggestions(location.coords.latitude, location.coords.longitude);
      setSmartSuggestions(suggestions);
    } catch (error) {
      Alert.alert('Error', 'Failed to get current location');
    }
  };

  const runAIAnalysis = async () => {
    if (aiProcessing) return;
    
    setAiProcessing(true);
    try {
      // Run AI classification and analysis in parallel
      const [classification, analysis] = await Promise.all([
        classifyIssue(issueData.title, issueData.description),
        analyzeIssueContent(issueData.title, issueData.description)
      ]);

      setAiClassification(classification);
      setAiAnalysis(analysis);

      // Auto-suggest category and priority if not set
      if (!issueData.category && classification.confidence > 0.8) {
        setIssueData(prev => ({...prev, category: classification.category}));
      }
      if (!issueData.priority && classification.confidence > 0.8) {
        setIssueData(prev => ({...prev, priority: classification.priority}));
      }
    } catch (error) {
      console.error('AI Analysis failed:', error);
    }
    setAiProcessing(false);
  };

  const startVoiceRecording = async () => {
    setVoiceRecording(true);
    try {
      // Mock voice recording - in real app, use expo-av to record
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Process voice input
      const transcription = await processVoiceInput('mock-audio-uri');
      
      // Add transcription to description
      setIssueData(prev => ({
        ...prev,
        description: prev.description + (prev.description ? '\n\n' : '') + transcription,
        voiceNote: transcription,
      }));

      Alert.alert('Voice Note Added', 'Your voice note has been transcribed and added to the description.');
    } catch (error) {
      Alert.alert('Error', 'Failed to process voice input');
    }
    setVoiceRecording(false);
  };

  const applyAISuggestion = (field: 'category' | 'priority' | 'title') => {
    if (!aiClassification) return;

    setIssueData(prev => ({
      ...prev,
      [field]: field === 'title' ? aiClassification.suggestedTitle : aiClassification[field],
    }));
  };

  const submitIssue = async () => {
    if (!issueData.title.trim()) {
      Alert.alert('Error', 'Please enter an issue title');
      return;
    }
    if (!issueData.category) {
      Alert.alert('Error', 'Please select a category');
      return;
    }
    if (!issueData.priority) {
      Alert.alert('Error', 'Please select a priority level');
      return;
    }

    setLoading(true);
    
    // Simulate API call with AI data
    setTimeout(() => {
      setLoading(false);
      Alert.alert(
        'Success!',
        `Your issue has been reported successfully with AI insights!\n\nAI Confidence: ${Math.round((aiClassification?.confidence || 0) * 100)}%\nEstimated Resolution: ${aiClassification?.estimatedResolutionTime || 'Unknown'}`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Reset form
              setIssueData({
                title: '',
                description: '',
                category: '',
                priority: '',
                images: [],
                location: issueData.location,
              });
              setAiClassification(null);
              setAiAnalysis(null);
            },
          },
        ]
      );
    }, 2000);
  };

  const renderAIInsights = () => {
    if (!aiClassification || !aiAnalysis) return null;

    return (
      <View style={styles.aiInsightsContainer}>
        <View style={styles.aiHeader}>
          <Text style={styles.aiTitle}>🤖 AI Insights</Text>
          <Text style={styles.aiConfidence}>
            {Math.round(aiClassification.confidence * 100)}% confident
          </Text>
        </View>

        {/* AI Suggestions */}
        <View style={styles.aiSuggestions}>
          {issueData.title.length < 10 && (
            <TouchableOpacity 
              style={styles.aiSuggestion}
              onPress={() => applyAISuggestion('title')}
            >
              <Text style={styles.aiSuggestionText}>
                💡 Suggested title: "{aiClassification.suggestedTitle}"
              </Text>
            </TouchableOpacity>
          )}

          {!issueData.category && (
            <TouchableOpacity 
              style={styles.aiSuggestion}
              onPress={() => applyAISuggestion('category')}
            >
              <Text style={styles.aiSuggestionText}>
                🏷️ Suggested category: {aiClassification.category}
              </Text>
            </TouchableOpacity>
          )}

          {!issueData.priority && (
            <TouchableOpacity 
              style={styles.aiSuggestion}
              onPress={() => applyAISuggestion('priority')}
            >
              <Text style={styles.aiSuggestionText}>
                ⚡ Suggested priority: {aiClassification.priority}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* AI Analysis */}
        <View style={styles.aiAnalysisGrid}>
          <View style={styles.aiAnalysisItem}>
            <Text style={styles.aiAnalysisLabel}>Urgency</Text>
            <Text style={styles.aiAnalysisValue}>{aiAnalysis.urgency}/10</Text>
          </View>
          <View style={styles.aiAnalysisItem}>
            <Text style={styles.aiAnalysisLabel}>Sentiment</Text>
            <Text style={styles.aiAnalysisValue}>
              {aiAnalysis.sentiment === 'positive' ? '😊' : 
               aiAnalysis.sentiment === 'negative' ? '😠' : '😐'}
            </Text>
          </View>
          <View style={styles.aiAnalysisItem}>
            <Text style={styles.aiAnalysisLabel}>Similar Issues</Text>
            <Text style={styles.aiAnalysisValue}>{aiClassification.similarIssues}</Text>
          </View>
          <View style={styles.aiAnalysisItem}>
            <Text style={styles.aiAnalysisLabel}>Est. Resolution</Text>
            <Text style={styles.aiAnalysisValue}>{aiClassification.estimatedResolutionTime}</Text>
          </View>
        </View>

        {/* Tags */}
        {aiClassification.tags.length > 0 && (
          <View style={styles.aiTags}>
            <Text style={styles.aiTagsLabel}>Tags:</Text>
            <View style={styles.aiTagsContainer}>
              {aiClassification.tags.map((tag, index) => (
                <View key={index} style={styles.aiTag}>
                  <Text style={styles.aiTagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>🤖 AI-Powered Reporting</Text>
        <Text style={styles.subtitle}>Smart issue classification & analysis</Text>
      </View>

      {/* AI Processing Indicator */}
      {aiProcessing && (
        <View style={styles.aiProcessingContainer}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.aiProcessingText}>AI analyzing your issue...</Text>
        </View>
      )}

      {/* AI Insights */}
      {(aiClassification || aiAnalysis) && renderAIInsights()}

      {/* Voice Input */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎤 Voice Input</Text>
        <TouchableOpacity 
          style={[styles.voiceButton, voiceRecording && styles.voiceButtonActive]}
          onPress={startVoiceRecording}
          disabled={voiceRecording}
        >
          {voiceRecording ? (
            <>
              <ActivityIndicator size="small" color={COLORS.white} />
              <Text style={styles.voiceButtonText}>Recording... (3s)</Text>
            </>
          ) : (
            <>
              <Text style={styles.voiceIcon}>🎤</Text>
              <Text style={styles.voiceButtonText}>Tap to describe issue by voice</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Title Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📋 Issue Title</Text>
        <TextInput
          style={styles.input}
          placeholder="Brief description of the issue"
          value={issueData.title}
          onChangeText={text => setIssueData(prev => ({...prev, title: text}))}
          maxLength={100}
        />
      </View>

      {/* Description Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📝 Description</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Provide detailed description..."
          value={issueData.description}
          onChangeText={text => setIssueData(prev => ({...prev, description: text}))}
          multiline
          numberOfLines={4}
          maxLength={500}
        />
      </View>

      {/* Category Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🏷️ Category</Text>
        <View style={styles.optionsGrid}>
          {CATEGORIES.map(category => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.optionCard,
                {borderColor: category.color},
                issueData.category === category.id && {backgroundColor: category.color + '20'},
                aiClassification?.category === category.id && !issueData.category && styles.aiSuggestedOption,
              ]}
              onPress={() => setIssueData(prev => ({...prev, category: category.id}))}
            >
              <Text style={styles.optionText}>{category.name}</Text>
              {aiClassification?.category === category.id && !issueData.category && (
                <Text style={styles.aiSuggestedLabel}>AI Suggested</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Priority Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚡ Priority Level</Text>
        <View style={styles.priorityRow}>
          {PRIORITIES.map(priority => (
            <TouchableOpacity
              key={priority.id}
              style={[
                styles.priorityCard,
                {borderColor: priority.color},
                issueData.priority === priority.id && {backgroundColor: priority.color + '20'},
                aiClassification?.priority === priority.id && !issueData.priority && styles.aiSuggestedOption,
              ]}
              onPress={() => setIssueData(prev => ({...prev, priority: priority.id}))}
            >
              <Text style={[styles.priorityText, {color: priority.color}]}>{priority.name}</Text>
              {aiClassification?.priority === priority.id && !issueData.priority && (
                <Text style={styles.aiSuggestedLabel}>AI</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Smart Suggestions */}
      {smartSuggestions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💡 Smart Suggestions</Text>
          {smartSuggestions.map((suggestion, index) => (
            <View key={index} style={styles.suggestionItem}>
              <Text style={styles.suggestionText}>• {suggestion}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
        onPress={submitIssue}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color={COLORS.white} />
        ) : (
          <Text style={styles.submitButtonText}>🚀 Submit with AI Insights</Text>
        )}
      </TouchableOpacity>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    padding: SPACING.lg,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  title: {
    ...TYPOGRAPHY.h1,
    color: COLORS.white,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.white,
    opacity: 0.9,
  },
  aiProcessingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.primary + '10',
    margin: SPACING.md,
    borderRadius: 8,
  },
  aiProcessingText: {
    ...TYPOGRAPHY.body,
    color: COLORS.primary,
    marginLeft: SPACING.sm,
  },
  aiInsightsContainer: {
    margin: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.primary + '30',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  aiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  aiTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.primary,
  },
  aiConfidence: {
    ...TYPOGRAPHY.caption,
    color: COLORS.success,
    fontWeight: 'bold',
  },
  aiSuggestions: {
    marginBottom: SPACING.md,
  },
  aiSuggestion: {
    backgroundColor: COLORS.primary + '10',
    padding: SPACING.sm,
    borderRadius: 8,
    marginBottom: SPACING.sm,
  },
  aiSuggestionText: {
    ...TYPOGRAPHY.body,
    color: COLORS.primary,
  },
  aiAnalysisGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  aiAnalysisItem: {
    width: '48%',
    alignItems: 'center',
    padding: SPACING.sm,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    marginBottom: SPACING.sm,
  },
  aiAnalysisLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  aiAnalysisValue: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontWeight: 'bold',
  },
  aiTags: {
    marginTop: SPACING.sm,
  },
  aiTagsLabel: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  aiTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  aiTag: {
    backgroundColor: COLORS.secondary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 12,
  },
  aiTagText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.white,
  },
  section: {
    margin: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  voiceButton: {
    backgroundColor: COLORS.secondary,
    padding: SPACING.lg,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceButtonActive: {
    backgroundColor: COLORS.primary,
  },
  voiceIcon: {
    fontSize: 24,
    marginRight: SPACING.sm,
  },
  voiceButtonText: {
    ...TYPOGRAPHY.body,
    color: COLORS.white,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: SPACING.md,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: SPACING.md,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  optionCard: {
    flex: 1,
    minWidth: '45%',
    padding: SPACING.md,
    borderWidth: 2,
    borderRadius: 8,
    alignItems: 'center',
  },
  optionText: {
    ...TYPOGRAPHY.body,
    textAlign: 'center',
  },
  aiSuggestedOption: {
    borderStyle: 'dashed',
    backgroundColor: COLORS.primary + '05',
  },
  aiSuggestedLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    fontWeight: 'bold',
    marginTop: SPACING.xs,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  priorityCard: {
    flex: 1,
    padding: SPACING.md,
    borderWidth: 2,
    borderRadius: 8,
    alignItems: 'center',
  },
  priorityText: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
  },
  suggestionItem: {
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  suggestionText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    margin: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    ...TYPOGRAPHY.h3,
    color: COLORS.white,
  },
  bottomPadding: {
    height: 50,
  },
});

export default ReportIssueScreenAI;