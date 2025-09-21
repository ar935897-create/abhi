import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Image, Modal } from 'react-native';
import { Camera, Upload, Send, X, CheckCircle, Clock, MapPin, FileText, User } from 'lucide-react-native';
import { getWorkProgress, submitWorkProgress, updateWorkProgress } from '../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { uploadMultipleImages } from '../lib/cloudinary';

export default function WorkProgressTracker({ 
  visible, 
  onClose, 
  issueId = null, 
  tenderId = null,
  contractorId = null 
}) {
  const [progressData, setProgressData] = useState({
    title: '',
    description: '',
    progress_percentage: 0,
    status: 'in_progress',
    materials_used: [],
    labor_hours: '',
    expenses_incurred: '',
    milestone_reached: '',
    next_milestone: '',
    contractor_notes: ''
  });
  const [selectedImages, setSelectedImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [existingProgress, setExistingProgress] = useState([]);

  useEffect(() => {
    if (visible) {
      loadExistingProgress();
    }
  }, [visible, issueId, tenderId]);

  const loadExistingProgress = async () => {
    try {
      const { data, error } = await getWorkProgress(contractorId, issueId, tenderId);
      if (error) throw error;
      setExistingProgress(data || []);
    } catch (error) {
      console.error('Error loading progress:', error);
    }
  };

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setSelectedImages([...selectedImages, ...result.assets]);
    }
  };

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setSelectedImages([...selectedImages, ...result.assets]);
    }
  };

  const removeImage = (index) => {
    setSelectedImages(selectedImages.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!progressData.title || !progressData.description) {
      Alert.alert('Error', 'Please fill in title and description');
      return;
    }

    try {
      setLoading(true);

      // Upload images if any
      let imageUrls = [];
      if (selectedImages.length > 0) {
        const imageUris = selectedImages.map(img => img.uri);
        const uploadResult = await uploadMultipleImages(imageUris);
        
        if (uploadResult.successful.length > 0) {
          imageUrls = uploadResult.successful.map(result => result.url);
        }
      }

      const progressPayload = {
        ...progressData,
        issue_id: issueId,
        tender_id: tenderId,
        images: imageUrls,
        materials_used: progressData.materials_used.filter(m => m.trim()),
        labor_hours: parseFloat(progressData.labor_hours) || 0,
        expenses_incurred: parseFloat(progressData.expenses_incurred) || 0
      };

      const { error } = await submitWorkProgress(progressPayload);
      if (error) throw error;

      Alert.alert(
        'Success',
        'Work progress has been submitted successfully',
        [
          {
            text: 'OK',
            onPress: () => {
              setProgressData({
                title: '',
                description: '',
                progress_percentage: 0,
                status: 'in_progress',
                materials_used: [],
                labor_hours: '',
                expenses_incurred: '',
                milestone_reached: '',
                next_milestone: '',
                contractor_notes: ''
              });
              setSelectedImages([]);
              onClose();
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error submitting progress:', error);
      Alert.alert('Error', 'Failed to submit progress: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'not_started': return '#6B7280';
      case 'in_progress': return '#1E40AF';
      case 'completed': return '#10B981';
      case 'on_hold': return '#F59E0B';
      case 'cancelled': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color="#6B7280" />
          </TouchableOpacity>
          <Text style={styles.title}>Work Progress</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.content}>
          {/* Existing Progress */}
          {existingProgress.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Previous Progress Updates</Text>
              <View style={styles.progressList}>
                {existingProgress.slice(0, 3).map((progress) => (
                  <View key={progress.id} style={styles.progressItem}>
                    <View style={styles.progressHeader}>
                      <Text style={styles.progressTitle}>{progress.title}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(progress.status) + '20' }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(progress.status) }]}>
                          {progress.status.replace('_', ' ').charAt(0).toUpperCase() + progress.status.replace('_', ' ').slice(1)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.progressDescription} numberOfLines={2}>
                      {progress.description}
                    </Text>
                    <View style={styles.progressMeta}>
                      <Text style={styles.progressPercentage}>{progress.progress_percentage}% Complete</Text>
                      <Text style={styles.progressDate}>{formatDate(progress.created_at)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* New Progress Form */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Submit New Progress Update</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Progress Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="Brief title for this update"
                value={progressData.title}
                onChangeText={(text) => setProgressData({...progressData, title: text})}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Progress Description *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Detailed description of work completed..."
                value={progressData.description}
                onChangeText={(text) => setProgressData({...progressData, description: text})}
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputGroupHalf}>
                <Text style={styles.label}>Progress %</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0-100"
                  value={String(progressData.progress_percentage)}
                  onChangeText={(text) => setProgressData({...progressData, progress_percentage: parseInt(text) || 0})}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.inputGroupHalf}>
                <Text style={styles.label}>Status</Text>
                <View style={styles.statusSelector}>
                  {['in_progress', 'completed', 'on_hold'].map((status) => (
                    <TouchableOpacity
                      key={status}
                      style={[
                        styles.statusOption,
                        progressData.status === status && styles.statusOptionActive
                      ]}
                      onPress={() => setProgressData({...progressData, status})}
                    >
                      <Text style={[
                        styles.statusOptionText,
                        progressData.status === status && styles.statusOptionTextActive
                      ]}>
                        {status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputGroupHalf}>
                <Text style={styles.label}>Labor Hours</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.0"
                  value={progressData.labor_hours}
                  onChangeText={(text) => setProgressData({...progressData, labor_hours: text})}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.inputGroupHalf}>
                <Text style={styles.label}>Expenses ($)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  value={progressData.expenses_incurred}
                  onChangeText={(text) => setProgressData({...progressData, expenses_incurred: text})}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Materials Used</Text>
              <TextInput
                style={styles.input}
                placeholder="List materials used (comma separated)"
                value={progressData.materials_used.join(', ')}
                onChangeText={(text) => setProgressData({
                  ...progressData, 
                  materials_used: text.split(',').map(m => m.trim()).filter(m => m)
                })}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Milestone Reached</Text>
              <TextInput
                style={styles.input}
                placeholder="What milestone was completed?"
                value={progressData.milestone_reached}
                onChangeText={(text) => setProgressData({...progressData, milestone_reached: text})}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Next Milestone</Text>
              <TextInput
                style={styles.input}
                placeholder="What's the next milestone?"
                value={progressData.next_milestone}
                onChangeText={(text) => setProgressData({...progressData, next_milestone: text})}
              />
            </View>

            {/* Photo Upload */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Progress Photos</Text>
              <Text style={styles.mediaHint}>Upload photos showing current progress</Text>
              <View style={styles.mediaContainer}>
                <TouchableOpacity style={styles.mediaButton} onPress={takePhoto}>
                  <Camera size={20} color="#1E40AF" />
                  <Text style={styles.mediaButtonText}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.mediaButton} onPress={pickImages}>
                  <Upload size={20} color="#1E40AF" />
                  <Text style={styles.mediaButtonText}>Upload Photos</Text>
                </TouchableOpacity>
              </View>

              {selectedImages.length > 0 && (
                <ScrollView horizontal style={styles.imagePreview} showsHorizontalScrollIndicator={false}>
                  {selectedImages.map((image, index) => (
                    <View key={index} style={styles.imageContainer}>
                      <Image source={{ uri: image.uri }} style={styles.previewImage} />
                      <TouchableOpacity
                        style={styles.removeImageButton}
                        onPress={() => removeImage(index)}
                      >
                        <X size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Additional Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Any additional notes or observations..."
                value={progressData.contractor_notes}
                onChangeText={(text) => setProgressData({...progressData, contractor_notes: text})}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>

          {/* Submit Button */}
          <View style={styles.submitSection}>
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Send size={20} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>
                {loading ? 'Submitting...' : 'Submit Progress Update'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  headerSpacer: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  progressList: {
    gap: 12,
  },
  progressItem: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressPercentage: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  progressDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  inputGroupHalf: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  statusSelector: {
    gap: 4,
  },
  statusOption: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusOptionActive: {
    backgroundColor: '#1E40AF',
    borderColor: '#1E40AF',
  },
  statusOptionText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    textAlign: 'center',
  },
  statusOptionTextActive: {
    color: '#FFFFFF',
  },
  mediaHint: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
  },
  mediaContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  mediaButton: {
    flex: 1,
    backgroundColor: '#F0F9FF',
    borderWidth: 2,
    borderColor: '#1E40AF',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
  },
  mediaButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1E40AF',
  },
  imagePreview: {
    marginTop: 12,
  },
  imageContainer: {
    position: 'relative',
    marginRight: 12,
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  submitButton: {
    backgroundColor: '#1E40AF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});